import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = (await getDriveContext(new URL(request.url).searchParams.get('database_id'))).client;
    const { data, error } = await supabase.from('projects').select('total_size, file_count').eq('id', params.id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil informasi storage.' }, { status: 500 });
  }
}
