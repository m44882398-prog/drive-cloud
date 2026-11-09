import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function DrivePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: defaultDatabase, error: defaultError } = await supabase
    .from('databases')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  if (defaultError) throw new Error(`Gagal memuat database default: ${defaultError.message}`)
  if (defaultDatabase) redirect(`/drive/${defaultDatabase.id}`)

  const { data: firstDatabase, error: firstError } = await supabase
    .from('databases')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (firstError) throw new Error(`Gagal memuat daftar database: ${firstError.message}`)
  if (!firstDatabase) redirect('/databases')

  redirect(`/drive/${firstDatabase.id}`)
}
