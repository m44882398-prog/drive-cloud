import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { supabaseAdmin } from './admin'
import { driveManager } from './drive-manager'

export type DesktopContext = {
  user: User
  client: SupabaseClient
  databaseId: string
}

export async function getDesktopContext(
  request: Request,
  databaseId: string,
): Promise<DesktopContext> {
  const token = getAccessToken(request)
  if (!token) throw new Error('UNAUTHORIZED')

  const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Konfigurasi Supabase BASE belum lengkap.')

  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error } = await auth.auth.getUser(token)
  if (error || !user) throw new Error('UNAUTHORIZED')

  const { data: database, error: databaseError } = await supabaseAdmin
    .from('databases')
    .select('id')
    .eq('id', databaseId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (databaseError) throw new Error(databaseError.message)
  if (!database) throw new Error('Database tidak ditemukan.')

  const client = await driveManager.getClient(databaseId, user.id)
  return { user, client, databaseId }
}

export function getAccessToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null

  if (authorization.startsWith('Bearer ')) return authorization.slice(7)
  if (authorization.startsWith('Basic ')) {
    try {
      const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
      const separator = credentials.indexOf(':')
      if (separator >= 0) return credentials.slice(separator + 1)
    } catch {
      return null
    }
  }
  return null
}
