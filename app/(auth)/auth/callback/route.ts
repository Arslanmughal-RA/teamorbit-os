import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[callback] exchangeCodeForSession failed:', exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('[callback] getUser failed:', userError?.message);
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  console.log('[callback] Authenticated as:', user.email);

  // Email whitelist check — only pre-seeded users can access
  const serviceClient = await createServiceClient();
  const { data: existingUser, error: profileError } = await (serviceClient
    .from('users') as any)
    .select('id, is_active')
    .eq('email', user.email!)
    .single() as { data: { id: string; is_active: boolean } | null; error: { message: string } | null };

  console.log('[callback] Whitelist lookup:', { existingUser, profileError });

  if (profileError || !existingUser || !existingUser.is_active) {
    console.error('[callback] Whitelist check failed:', profileError?.message);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=whitelist_failed`);
  }

  // Sync public.users.id to match the real Google auth UUID (runs once per user)
  if (existingUser.id !== user.id) {
    console.log('[callback] Syncing user ID:', existingUser.id, '->', user.id);
    await (serviceClient
      .from('users') as any)
      .update({ id: user.id })
      .eq('email', user.email!);
  }

  return NextResponse.redirect(`${origin}/`);
}
