'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient as baseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = baseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    console.log('Attempting login:', { email });
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    console.log('Login result:', { error: signInError });

    if (signInError) {
      console.error('Login error:', signInError);
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-6">
          <p className="text-sm text-blue-300">Cloud Drive</p>
          <h1 className="mt-2 text-3xl font-bold">Masuk ke akun</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
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

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">Hubungi admin untuk akses.</p>
      </div>
    </main>
  );
}
