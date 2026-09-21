import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, database_id: databaseId } = body;
    const supabase = (await getDriveContext(databaseId)).client;
    const { data, error } = await supabase.from('folders').update({ name }).eq('id', params.id).select().single();

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
    const supabase = (await getDriveContext(new URL(request.url).searchParams.get('database_id'))).client;
    const { error } = await supabase.from('folders').delete().eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus folder.' }, { status: 500 });
  }
}
