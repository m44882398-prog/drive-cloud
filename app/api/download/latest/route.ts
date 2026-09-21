import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('app_releases')
      .select('*')
      .eq('is_latest', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data ?? { message: 'Belum ada release.' });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil info installer.' }, { status: 500 });
  }
}
