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

  const serviceClient = await createServiceClient();

  // Look up existing user by email
  const { data: existingUser } = await (serviceClient
    .from('users') as any)
    .select('id, is_active')
    .eq('email', user.email!)
    .single() as { data: { id: string; is_active: boolean } | null; error: unknown };

  if (existingUser) {
    // User exists — check if active
    if (!existingUser.is_active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=whitelist_failed`);
    }
    // Sync ID if it changed (first login after manual insert)
    if (existingUser.id !== user.id) {
      await (serviceClient.from('users') as any)
        .update({ id: user.id })
        .eq('email', user.email!);
    }
  } else {
    // First time — auto-create with developer role
    const fullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email!.split('@')[0];

    const { error: insertError } = await (serviceClient.from('users') as any).insert({
      id:        user.id,
      email:     user.email!,
      full_name: fullName,
      role:      'developer',
      is_active: true,
    });

    if (insertError) {
      console.error('[callback] Auto-create failed:', insertError.message);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=create_failed`);
    }

    console.log('[callback] Auto-created user:', user.email);
  }

  return NextResponse.redirect(`${origin}/`);
}
