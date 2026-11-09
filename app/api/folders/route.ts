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

    const { client: supabase, user } = await getDriveContext(databaseId);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });

    let query = supabase
      .from('folders')
      .select('*')
      .eq('project_id', projectId);
    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
    const { data, error } = await query.order('created_at', { ascending: false });

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
    if (!project_id || !name?.trim()) {
      return NextResponse.json({ error: 'Nama folder dan project wajib diisi.' }, { status: 400 });
    }
    const { client: supabase, user } = await getDriveContext(databaseId);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });

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
