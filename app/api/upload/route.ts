import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getCurrentUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const taskId = formData.get('task_id') as string | null;

  if (!file) {
    return NextResponse.json({ data: null, error: { message: 'No file provided', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const prefix = taskId ?? currentUser.id;
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const service = await createServiceClient();
  const { data, error } = await service.storage
    .from('task-attachments')
    .upload(filename, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'UPLOAD_ERROR' } }, { status: 500 });

  const { data: { publicUrl } } = service.storage
    .from('task-attachments')
    .getPublicUrl(data.path);

  return NextResponse.json({ data: { url: publicUrl, path: data.path }, error: null }, { status: 201 });
}
