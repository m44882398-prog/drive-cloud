import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 })
    }
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Konfigurasi Supabase BASE belum lengkap.' }, { status: 500 })
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return NextResponse.json({ error: error?.message ?? 'Login gagal.' }, { status: 401 })
    }

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      email: data.user.email,
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Login gagal.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
