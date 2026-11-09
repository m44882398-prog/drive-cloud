import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, database_id: databaseId } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Nama folder wajib diisi.' }, { status: 400 });
    const { client: supabase, user } = await getDriveContext(databaseId);
    const { data: projects, error: projectError } = await supabase.from('projects').select('id').eq('user_id', user.id);
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (projects.length === 0) return NextResponse.json({ error: 'Folder tidak ditemukan.' }, { status: 404 });
    const { data, error } = await supabase.from('folders').update({ name }).eq('id', params.id)
      .in('project_id', projects.map((project) => project.id))
      .select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal rename folder.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user } = await getDriveContext(new URL(request.url).searchParams.get('database_id'));
    const { data: projects, error: projectError } = await supabase.from('projects').select('id').eq('user_id', user.id);
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (projects.length === 0) return NextResponse.json({ error: 'Folder tidak ditemukan.' }, { status: 404 });
    const { error } = await supabase.from('folders').delete().eq('id', params.id)
      .in('project_id', projects.map((project) => project.id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus folder.' }, { status: 500 });
  }
}
