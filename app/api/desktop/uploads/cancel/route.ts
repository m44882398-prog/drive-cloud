import { NextResponse } from 'next/server'
import { getDesktopContext } from '@/lib/supabase/desktop-auth'

export async function POST(request: Request) {
  try {
    const { databaseId, storagePath } = await request.json()
    if (!databaseId || !storagePath) return NextResponse.json({ error: 'databaseId dan storagePath wajib diisi.' }, { status: 400 })
    const { client, user } = await getDesktopContext(request, databaseId)
    if (typeof storagePath !== 'string' || !storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Storage path tidak valid.' }, { status: 400 })
    }
    const { error } = await client.storage.from('drive-files').remove([storagePath])
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal membersihkan upload yang batal.'
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : 500 })
  }
}
