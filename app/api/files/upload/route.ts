import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const databaseId = formData.get('database_id') as string | null;
    const folderId = formData.get('folderId') as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: 'File dan projectId wajib diisi.' }, { status: 400 });
    }

    const { client: supabase, user } = await getDriveContext(databaseId);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('project_id', projectId)
        .maybeSingle();
      if (folderError) return NextResponse.json({ error: folderError.message }, { status: 400 });
      if (!folder) return NextResponse.json({ error: 'Folder tidak ditemukan di project ini.' }, { status: 404 });
    }

    const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}/${file.name}`;
    const { data, error } = await supabase.storage.from('drive-files').upload(storagePath, file, {
      upsert: false,
      cacheControl: '3600',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: fileRecord, error: recordError } = await supabase.from('files').insert({
      project_id: projectId,
      folder_id: folderId || null,
      name: file.name,
      size: file.size,
      mime_type: file.type || null,
      extension: file.name.includes('.') ? file.name.split('.').pop() : null,
      storage_path: storagePath,
    }).select('id, name, size').single();

    if (recordError) {
      const { error: cleanupError } = await supabase.storage.from('drive-files').remove([storagePath]);
      if (cleanupError) {
        return NextResponse.json({ error: `${recordError.message} (Gagal membersihkan file storage: ${cleanupError.message})` }, { status: 500 });
      }
      return NextResponse.json({ error: recordError.message }, { status: 400 });
    }

    return NextResponse.json({ storage: data, file: fileRecord, path: storagePath });
  } catch {
    return NextResponse.json({ error: 'Gagal upload file.' }, { status: 500 });
  }
}
