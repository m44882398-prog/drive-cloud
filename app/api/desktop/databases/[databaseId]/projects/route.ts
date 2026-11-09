import { NextResponse } from 'next/server'
import { getDesktopContext } from '@/lib/supabase/desktop-auth'

export async function GET(request: Request, { params }: { params: { databaseId: string } }) {
  try {
    const { client, user } = await getDesktopContext(request, params.databaseId)
    const { data, error } = await client
      .from('projects')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name')
    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal memuat project.'
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : 500 })
  }
}
