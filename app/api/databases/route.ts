import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await auth
    .from('databases')
    .select('id, name, description, color, icon, is_active, is_default, last_synced_at, total_size, file_count, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, description, supabase_url, supabase_anon_key, supabase_service_key, color, icon } = body;
  if (!name || !supabase_url || !supabase_anon_key) {
    return NextResponse.json({ error: 'Nama, URL Supabase, dan anon key wajib diisi.' }, { status: 400 });
  }

  const { data, error } = await auth.from('databases').insert({
    user_id: user.id,
    name,
    description,
    supabase_url,
    supabase_anon_key,
    supabase_service_key: supabase_service_key || null,
    color: color ?? '#3B82F6',
    icon: icon ?? 'database',
  }).select('id, name, description, color, icon, is_active, is_default, created_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
