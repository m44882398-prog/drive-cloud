import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const folderId = searchParams.get('folderId');
    const databaseId = searchParams.get('database_id');

    const { client: supabase } = await getDriveContext(databaseId);

    let query = supabase.from('files').select('*').eq('project_id', projectId ?? '').eq('is_trashed', false);

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('folder_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil file.' }, { status: 500 });
  }
}
