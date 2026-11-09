import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await auth
    .from('databases')
    .select('id, name, description, color, icon, is_active, is_default, last_synced_at, total_size, file_count, created_at, updated_at, supabase_url, supabase_anon_key, s3_access_key, s3_secret_key, s3_region, s3_endpoint')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json((data ?? []).map((database) => ({
    ...database,
    s3_secret_key: database.s3_secret_key ? '***' : null,
  })));
}

export async function POST(request: Request) {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name,
    description,
    supabase_url,
    supabase_anon_key,
    supabase_service_key,
    s3_access_key,
    s3_secret_key,
    s3_region,
    color,
    icon,
  } = body;
  if (!name?.trim() || typeof supabase_url !== 'string' || !supabase_anon_key || !supabase_service_key) {
    return NextResponse.json({ error: 'Nama, URL Supabase, anon key, dan service role key wajib diisi.' }, { status: 400 });
  }
  let normalizedSupabaseUrl: string;
  try {
    const url = new URL(supabase_url.trim());
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/i.test(url.hostname) ||
      url.port ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return NextResponse.json({
        error: 'URL harus berupa URL project Supabase HTTPS yang valid, contoh https://xxx.supabase.co.',
      }, { status: 400 });
    }
    normalizedSupabaseUrl = url.origin;
  } catch {
    return NextResponse.json({
      error: 'URL Supabase tidak valid. Gunakan format https://xxx.supabase.co.',
    }, { status: 400 });
  }
  if (
    typeof s3_access_key !== 'string' || !s3_access_key.trim() ||
    typeof s3_secret_key !== 'string' || !s3_secret_key.trim() ||
    typeof s3_region !== 'string' || !s3_region.trim()
  ) {
    return NextResponse.json({ error: 'S3 access key, secret key, dan region wajib diisi.' }, { status: 400 });
  }

  let cloudClient: ReturnType<typeof createClient>;
  try {
    cloudClient = createClient(normalizedSupabaseUrl, supabase_service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return NextResponse.json({ error: 'URL atau service role key Supabase tidak valid.' }, { status: 400 });
  }

  const { error: projectsError } = await cloudClient.from('projects').select('id').limit(1);
  if (projectsError) {
    return NextResponse.json({
      error: `Koneksi database gagal: ${projectsError.message}. Pastikan skema supabase/drive sudah dijalankan dan service role key benar.`,
    }, { status: 400 });
  }

  const { error: storageError } = await cloudClient.storage.from('drive-files').list('', { limit: 1 });
  if (storageError) {
    return NextResponse.json({
      error: `Bucket Storage "drive-files" belum tersedia atau tidak bisa diakses: ${storageError.message}`,
    }, { status: 400 });
  }

  const { data, error } = await auth.from('databases').insert({
    user_id: user.id,
    name: name.trim(),
    description,
    supabase_url: normalizedSupabaseUrl,
    supabase_anon_key,
    supabase_service_key: supabase_service_key || null,
    s3_access_key: s3_access_key.trim(),
    s3_secret_key: s3_secret_key.trim(),
    s3_region: s3_region.trim(),
    s3_endpoint: `${normalizedSupabaseUrl}/storage/v1/s3`,
    color: color ?? '#3B82F6',
    icon: icon ?? 'database',
  }).select('id, name, description, color, icon, is_active, is_default, created_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
