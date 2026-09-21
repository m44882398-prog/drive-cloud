import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const action = searchParams.get('action');
    const date = searchParams.get('date');
    const databaseId = searchParams.get('database_id');

    const { client: supabase, user } = await getDriveContext(databaseId);

    let query = supabase.from('activity_logs').select('*').eq('user_id', user.id);

    if (projectId) query = query.eq('project_id', projectId);
    if (action) query = query.eq('action', action);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const filtered = date
      ? data.filter((item) => new Date(item.created_at ?? '').toDateString() === new Date(date).toDateString())
      : data;

    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil activity log.' }, { status: 500 });
  }
}
