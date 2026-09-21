import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request) {
  try {
    const databaseId = new URL(request.url).searchParams.get('database_id');
    const { client: supabase, user } = await getDriveContext(databaseId);

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data project.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color, icon, database_id: databaseId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama project wajib diisi.' }, { status: 400 });
    }

    const { client: supabase, user } = await getDriveContext(databaseId);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description,
        color: color ?? '#3B82F6',
        icon: icon ?? 'folder',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat project.' }, { status: 500 });
  }
}
