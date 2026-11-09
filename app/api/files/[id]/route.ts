import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user } = await getDriveContext(new URL(request.url).searchParams.get('database_id'));
    const { data, error } = await supabase.from('files').select('*, projects!inner(user_id)').eq('id', params.id).eq('projects.user_id', user.id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil detail file.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { client: supabase, user } = await getDriveContext(body.database_id);
    delete body.database_id;
    const { data, error } = await supabase.from('files').update(body).eq('id', params.id).select('*, projects!inner(user_id)').eq('projects.user_id', user.id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal update file.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user } = await getDriveContext(new URL(request.url).searchParams.get('database_id'));
    const { data: projects, error: projectError } = await supabase.from('projects').select('id').eq('user_id', user.id);
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
    if (projects.length === 0) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
    const projectIds = projects.map((project) => project.id);
    const { error } = await supabase
      .from('files')
      .update({ is_trashed: true, trashed_at: new Date().toISOString() })
      .eq('id', params.id)
      .in('project_id', projectIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus file.' }, { status: 500 });
  }
}
