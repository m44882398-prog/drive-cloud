import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-6">
          <p className="text-sm text-blue-300">Cloud Drive</p>
          <h1 className="mt-2 text-3xl font-bold">Masuk ke akun</h1>
        </div>

        <form className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <Input type="password" placeholder="••••••••" />
          </div>

          <div className="flex items-center justify-between text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-slate-700 bg-slate-800" />
              Ingat saya
            </label>
            <Link href="/forgot-password" className="text-blue-400 hover:underline">
              Lupa password?
            </Link>
          </div>

          <Button type="submit" className="w-full">
            Masuk
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">Hubungi admin untuk akses.</p>
      </div>
    </main>
  );
}
