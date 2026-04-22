import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: comments, error } = await (supabase.from('task_comments') as any)
    .select('*, user:users!task_comments_user_id_fkey(id, full_name, avatar_url)')
    .eq('task_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: comments ?? [], error: null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json();
  const { content, mentions = [] } = body as { content: string; mentions?: string[] };

  if (!content?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'Content is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: comment, error } = await (service.from('task_comments') as any)
    .insert({
      task_id: id,
      user_id: currentUser.id,
      content: content.trim(),
      mentions,
    })
    .select('*, user:users!task_comments_user_id_fkey(id, full_name, avatar_url)')
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: comment, error: null }, { status: 201 });
}
