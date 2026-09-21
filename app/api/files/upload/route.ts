import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const databaseId = formData.get('database_id') as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: 'File dan projectId wajib diisi.' }, { status: 400 });
    }

    const { client: supabase, user } = await getDriveContext(databaseId);

    const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}/${file.name}`;
    const { data, error } = await supabase.storage.from('drive-files').upload(storagePath, file, {
      upsert: false,
      cacheControl: '3600',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ storage: data, path: storagePath });
  } catch {
    return NextResponse.json({ error: 'Gagal upload file.' }, { status: 500 });
  }
}
