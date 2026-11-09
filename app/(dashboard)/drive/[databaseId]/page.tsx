import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectCreateButton } from '@/components/databases/project-create-button'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDriveContext } from '@/lib/supabase/drive-context'

type Project = {
  id: string
  name: string
  description: string | null
  color: string | null
  file_count: number | null
}

export default async function DatabaseDrivePage({ params }: { params: { databaseId: string } }) {
  const auth = createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const { data: database, error: databaseError } = await auth
    .from('databases')
    .select('id, name, supabase_url')
    .eq('id', params.databaseId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (databaseError) throw new Error(`Gagal memuat database: ${databaseError.message}`)
  if (!database) notFound()

  let projects: Project[] = []
  let loadError = ''
  try {
    const { client } = await getDriveContext(params.databaseId)
    const { data, error } = await client
      .from('projects')
      .select('id, name, description, color, file_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) loadError = error.message
    projects = data ?? []
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'Gagal memuat project.'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href="/databases" className="hover:text-blue-600">Databases</Link>
            <span className="mx-2">›</span>
            <span>{database.name}</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold">{database.name}</h1>
          <p className="text-sm text-slate-500">Project dalam database ini.</p>
          <p className="mt-1 break-all text-xs text-slate-400">{database.supabase_url}</p>
        </div>
        <ProjectCreateButton databaseId={database.id} />
      </div>

      {loadError ? (
        <Card><CardContent className="py-16 text-center text-sm text-red-600">{loadError}</CardContent></Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-xl font-semibold">Belum ada project</h2>
            <p className="mt-2 text-sm text-slate-500">Buat project baru untuk mulai mengelola file.</p>
            <ProjectCreateButton databaseId={database.id} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-5">
                <div className="mb-4 h-3 w-3 rounded-full" style={{ backgroundColor: project.color ?? '#3B82F6' }} />
                <h2 className="font-semibold">{project.name}</h2>
                <p className="mt-2 text-sm text-slate-500">{project.description ?? 'Cloud Drive project'}</p>
                <div className="mt-4 text-xs text-slate-500">{project.file_count ?? 0} file</div>
                <Button asChild className="mt-4 w-full">
                  <Link href={`/drive/${database.id}/${project.id}`}>Buka</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
