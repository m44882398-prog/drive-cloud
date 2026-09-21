import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { driveManager } from '@/lib/supabase/drive-manager';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await auth.from('databases')
    .select('supabase_url, supabase_anon_key').eq('id', params.id).eq('user_id', user.id).eq('is_active', true).single();
  if (error || !data) return NextResponse.json({ error: 'Database cloud tidak ditemukan.' }, { status: 404 });

  try {
    await driveManager.getClient(params.id, user.id);
    return NextResponse.json(data);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Koneksi database gagal.' }, { status: 502 });
  }
}
