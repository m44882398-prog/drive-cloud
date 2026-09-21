import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-col px-6 py-10">
        <header className="mb-10 flex items-center justify-between">
          <div className="text-xl font-bold">Cloud Drive</div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white">
              Login
            </Link>
          </nav>
        </header>

        <section className="grid gap-8 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              Cloud storage for Windows
            </p>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight md:text-6xl">
              Cloud Drive Windows dengan sinkronisasi dua arah.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Kelola file dari browser, unduh client Windows, dan akses folder virtual di File Explorer dengan sinkronisasi real-time ke Supabase.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/login">
                <Button size="lg">Masuk ke Cloud Drive</Button>
              </Link>
              <Link href="/download">
                <Button variant="outline" size="lg" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  Download Desktop Client
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm text-slate-300">Storage Overview</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Aktif</span>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between text-sm text-slate-300">
                  <span>Project/Files</span>
                  <span>72%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div className="h-2.5 w-[72%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-sm text-slate-400">Project</div>
                  <div className="mt-2 text-2xl font-bold">12</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-sm text-slate-400">Files</div>
                  <div className="mt-2 text-2xl font-bold">1.2K</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
                <div className="mb-2 flex items-center justify-between">
                  <span>Last sync</span>
                  <span>2 mins ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Windows device</span>
                  <span className="text-emerald-400">Synced</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
