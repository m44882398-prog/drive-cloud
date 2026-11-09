import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatabaseForm } from '@/components/databases/database-form'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Database = {
  id: string
  name: string
  description: string | null
  color: string | null
  file_count: number | null
}

type DatabasesResult = {
  databases: Database[]
  setupRequired: boolean
}

async function getDatabases(): Promise<DatabasesResult> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { databases: [], setupRequired: false }

  const { data, error } = await supabase
    .from('databases')
    .select('id, name, description, color, file_count')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    const missingDatabasesTable =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message.includes("Could not find the table 'public.databases'")

    if (missingDatabasesTable) return { databases: [], setupRequired: true }
    throw new Error(`Gagal memuat database: ${error.message}`)
  }
  return { databases: data ?? [], setupRequired: false }
}

export default async function DatabasesPage() {
  const { databases, setupRequired } = await getDatabases()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cloud Databases</h1>
          <p className="text-sm text-slate-500">Pilih sumber data cloud drive yang ingin digunakan.</p>
        </div>
        {!setupRequired && <DatabaseForm />}
      </div>

      {setupRequired ? (
        <Card>
          <CardContent className="py-10">
            <h2 className="text-xl font-semibold">Setup database BASE diperlukan</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tabel <code>public.databases</code> belum ditemukan. Jalankan skema BASE pada project Supabase yang URL-nya diatur di <code>NEXT_PUBLIC_BASE_SUPABASE_URL</code>.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Buka SQL Editor di project Supabase BASE yang benar.</li>
              <li>Jalankan seluruh isi <code>supabase/base/001_base_schema.sql</code>.</li>
              <li>Lalu jalankan seluruh isi <code>supabase/base/002_rls_policies.sql</code>.</li>
              <li>Refresh halaman ini setelah query selesai.</li>
            </ol>
            <p className="mt-4 text-sm text-slate-500">
              Pastikan ini project BASE aplikasi, bukan project cloud database yang nanti ditambahkan dari halaman ini.
            </p>
          </CardContent>
        </Card>
      ) : databases.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-xl font-semibold">Belum ada database cloud</h2>
            <p className="mt-2 text-sm text-slate-500">Tambahkan koneksi Supabase untuk mulai menyimpan project.</p>
            <DatabaseForm buttonLabel="Buat Database Pertama" className="mt-6" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {databases.map((database) => (
            <Card key={database.id} className="h-full transition hover:border-blue-400">
              <CardHeader>
                <div className="mb-2 h-3 w-3 rounded-full" style={{ backgroundColor: database.color ?? '#3B82F6' }} />
                <CardTitle>{database.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{database.description ?? 'Cloud Drive database'}</p>
                <div className="mt-4 text-sm text-slate-600">{database.file_count ?? 0} file</div>
                <Button asChild className="mt-4 w-full">
                  <Link href={`/drive/${database.id}`}>Buka</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
