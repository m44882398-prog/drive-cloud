import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDriveContext } from '@/lib/supabase/drive-context';

export default async function DatabaseProjectsPage({ params }: { params: { id: string } }) {
  let projects: Array<{ id: string; name: string; description?: string | null; color?: string | null; total_size?: number; file_count?: number }> = [];
  let loadError = '';

  try {
    const { client } = await getDriveContext(params.id);
    const { data, error } = await client.from('projects').select('id, name, description, color, total_size, file_count').order('created_at', { ascending: false });
    if (error) loadError = error.message;
    projects = data ?? [];
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'Gagal memuat project.';
  }

  return <div className="space-y-6 p-6"><div className="flex items-center justify-between"><div><Link href="/databases" className="text-sm text-blue-600">← Semua database</Link><h1 className="mt-2 text-3xl font-bold">Projects</h1><p className="text-sm text-slate-500">Database cloud: {params.id}</p></div><Button>Buat Project</Button></div>
    {loadError ? <Card><CardContent className="py-16 text-center text-sm text-red-600">{loadError}</CardContent></Card> : projects.length === 0 ? <Card><CardContent className="py-16 text-center"><h2 className="text-xl font-semibold">Buat Project Pertama</h2><p className="mt-2 text-sm text-slate-500">Database cloud ini belum memiliki project.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Card key={project.id}><CardContent className="p-5"><div className="mb-4 h-3 w-3 rounded-full" style={{ backgroundColor: project.color ?? '#3B82F6' }} /><h2 className="font-semibold">{project.name}</h2><p className="mt-2 text-sm text-slate-500">{project.description ?? 'Cloud Drive project'}</p><div className="mt-4 text-xs text-slate-500">{project.file_count ?? 0} file</div></CardContent></Card>)}</div>}
  </div>;
}
