import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAccessToken } from '@/lib/supabase/desktop-auth'

async function getUser(request: Request) {
  const token = getAccessToken(request)
  const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return null

  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error } = await auth.auth.getUser(token)
  return error ? null : user
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('databases')
      .select('id, name, is_default, supabase_url, s3_access_key, s3_secret_key, s3_region, s3_endpoint')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    return NextResponse.json(data ?? [], {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal memuat konfigurasi desktop.'
    console.error('Desktop database config fetch failed:', cause)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { defaultDatabaseId?: unknown }
    if (typeof body.defaultDatabaseId !== 'string' || !body.defaultDatabaseId) {
      return NextResponse.json({ error: 'defaultDatabaseId wajib diisi.' }, { status: 400 })
    }

    const { data: database, error: lookupError } = await supabaseAdmin
      .from('databases')
      .select('id')
      .eq('id', body.defaultDatabaseId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (lookupError) throw new Error(lookupError.message)
    if (!database) return NextResponse.json({ error: 'Database tidak ditemukan.' }, { status: 404 })

    const { error: setError } = await supabaseAdmin
      .from('databases')
      .update({ is_default: true })
      .eq('id', database.id)
      .eq('user_id', user.id)
    if (setError) throw new Error(setError.message)

    const { error: clearError } = await supabaseAdmin
      .from('databases')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .neq('id', database.id)
    if (clearError) throw new Error(clearError.message)

    return NextResponse.json({ defaultDatabaseId: database.id })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal mengubah database default.'
    console.error('Desktop default database update failed:', cause)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
