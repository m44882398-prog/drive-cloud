import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const databaseId = new URL(request.url).searchParams.get('database_id');
    if (!databaseId) return NextResponse.json({ error: 'database_id wajib diisi.' }, { status: 400 });
    const { data: database, error: databaseError } = await supabaseAdmin.from('databases').select('supabase_url, supabase_anon_key').eq('id', databaseId).eq('is_active', true).single();
    if (databaseError || !database) return NextResponse.json({ error: 'Database cloud tidak ditemukan.' }, { status: 404 });
    const supabase = createClient(database.supabase_url, database.supabase_anon_key);
    const { data, error } = await supabase
      .from('shared_links')
      .select('*, files(*)')
      .eq('token', params.token)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Link tidak valid atau kedaluwarsa.' }, { status: 404 });
    }

    return NextResponse.json({ link: data, file: data.files });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses share link.' }, { status: 500 });
  }
}
