import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

async function getDatabases() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/databases`, { cache: 'no-store' });
  if (!response.ok) return [];
  return response.json() as Promise<Array<{ id: string; name: string; description?: string | null; color?: string | null; file_count?: number; total_size?: number }>>;
}

export default async function DatabasesPage() {
  const databases = await getDatabases();

  return <div className="space-y-6 p-6">
    <div className="flex items-center justify-between">
      <div><h1 className="text-3xl font-bold">Cloud Databases</h1><p className="text-sm text-slate-500">Pilih sumber data cloud drive yang ingin digunakan.</p></div>
      <Button>Tambah Database</Button>
    </div>
    {databases.length === 0 ? <Card><CardContent className="py-16 text-center"><h2 className="text-xl font-semibold">Belum ada database cloud</h2><p className="mt-2 text-sm text-slate-500">Tambahkan koneksi Supabase untuk mulai menyimpan project.</p><Button className="mt-6">Buat Database Pertama</Button></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {databases.map((database) => <Link key={database.id} href={`/databases/${database.id}`}><Card className="h-full transition hover:border-blue-400"><CardHeader><div className="mb-2 h-3 w-3 rounded-full" style={{ backgroundColor: database.color ?? '#3B82F6' }} /><CardTitle>{database.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-500">{database.description ?? 'Cloud Drive database'}</p><div className="mt-4 text-sm text-slate-600">{database.file_count ?? 0} file</div></CardContent></Card></Link>)}
    </div>}
  </div>;
}
