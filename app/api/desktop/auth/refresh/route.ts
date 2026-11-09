import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json()
    const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
    if (!refreshToken || !url || !anonKey) {
      return NextResponse.json({ error: 'Refresh token atau konfigurasi Supabase tidak tersedia.' }, { status: 400 })
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) {
      return NextResponse.json({ error: error?.message ?? 'Sesi kedaluwarsa. Silakan login kembali.' }, { status: 401 })
    }

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      email: data.user?.email,
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal memperbarui sesi.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
