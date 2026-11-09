import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const keepAliveSecret = process.env.KEEP_ALIVE_SECRET
  const authorization = request.headers.get('authorization')
  const providedSecret = request.headers.get('x-keep-alive-secret')

  return Boolean(
    (cronSecret && authorization === `Bearer ${cronSecret}`) ||
    (keepAliveSecret && providedSecret === keepAliveSecret)
  )
}

async function responseDetail(response: Response) {
  const text = await response.text()
  if (!text) return `HTTP ${response.status}`

  try {
    const body: unknown = JSON.parse(text)
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return String(body.message)
    }
  } catch {
    return text.slice(0, 500)
  }

  return text.slice(0, 500)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET && !process.env.KEEP_ALIVE_SECRET) {
    return NextResponse.json(
      { error: 'Atur CRON_SECRET atau KEEP_ALIVE_SECRET untuk mengaktifkan endpoint keep-alive.' },
      { status: 503 }
    )
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
  const baseKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
  if (!baseUrl || !baseKey) {
    const error = 'Konfigurasi Supabase BASE belum lengkap.'
    console.error(`Keep-alive BASE failed: ${error}`)
    return NextResponse.json({ base: 'error', error, drives: [] }, { status: 500 })
  }

  let baseOrigin: string
  try {
    baseOrigin = new URL(baseUrl).origin
  } catch (cause) {
    const error = 'NEXT_PUBLIC_BASE_SUPABASE_URL bukan URL yang valid.'
    console.error('Keep-alive BASE failed:', cause)
    return NextResponse.json({ base: 'error', error, drives: [] }, { status: 500 })
  }

  try {
    const response = await fetch(`${baseOrigin}/rest/v1/`, {
      headers: { apikey: baseKey },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`BASE REST API check failed: ${await responseDetail(response)}`)
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'BASE Supabase tidak dapat diakses.'
    console.error('Keep-alive BASE failed:', cause)
    return NextResponse.json({ base: 'error', error, drives: [] }, { status: 500 })
  }

  return NextResponse.json({ base: 'ok', drives: [] })
}
