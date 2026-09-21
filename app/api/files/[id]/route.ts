import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = (await getDriveContext(new URL(request.url).searchParams.get('database_id'))).client;
    const { data, error } = await supabase.from('files').select('*').eq('id', params.id).single();

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
    const supabase = (await getDriveContext(body.database_id)).client;
    delete body.database_id;
    const { data, error } = await supabase.from('files').update(body).eq('id', params.id).select().single();

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
    const supabase = (await getDriveContext(new URL(request.url).searchParams.get('database_id'))).client;
    const { error } = await supabase.from('files').update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus file.' }, { status: 500 });
  }
}
