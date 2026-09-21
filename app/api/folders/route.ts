import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const parentId = searchParams.get('parentId');
    const databaseId = searchParams.get('database_id');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
    }

    const { client: supabase } = await getDriveContext(databaseId);
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('project_id', projectId)
      .eq(parentId ? 'parent_id' : 'id', parentId ?? '');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil folder.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { project_id, name, parent_id, database_id: databaseId } = await request.json();
    const { client: supabase } = await getDriveContext(databaseId);

    const { data, error } = await supabase
      .from('folders')
      .insert({
        project_id,
        name,
        parent_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat folder.' }, { status: 500 });
  }
}
