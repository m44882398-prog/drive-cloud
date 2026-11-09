import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FileExplorer } from '@/components/drive/file-explorer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDriveContext } from '@/lib/supabase/drive-context'

export default async function ProjectDrivePage({
  params,
}: {
  params: { databaseId: string; projectId: string }
}) {
  const auth = createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const { data: database, error: databaseError } = await auth
    .from('databases')
    .select('id, name')
    .eq('id', params.databaseId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (databaseError) throw new Error(`Gagal memuat database: ${databaseError.message}`)
  if (!database) notFound()

  const { client } = await getDriveContext(params.databaseId)
  const { data: project, error } = await client
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error(`Gagal memuat project: ${error.message}`)
  if (!project) notFound()

  return (
    <div className="space-y-6 p-6">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href="/databases" className="hover:text-blue-600">Databases</Link>
          <span className="mx-2">›</span>
          <Link href={`/drive/${database.id}`} className="hover:text-blue-600">{database.name}</Link>
          <span className="mx-2">›</span>
          <span>{project.name}</span>
        </nav>
        <h1 className="mt-2 text-3xl font-bold">{project.name}</h1>
      </div>
      <FileExplorer databaseId={database.id} projectId={project.id} />
    </div>
  )
}
