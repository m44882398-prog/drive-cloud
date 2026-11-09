import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/supabase/desktop-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const token = getAccessToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
    if (!url || !anonKey) throw new Error('Konfigurasi Supabase BASE belum lengkap.')

    const auth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: { user }, error: authError } = await auth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('databases')
      .select('id, name, is_default')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal memuat database.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
