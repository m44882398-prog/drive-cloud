import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-6">
          <p className="text-sm text-blue-300">Cloud Drive</p>
          <h1 className="mt-2 text-3xl font-bold">Reset password</h1>
        </div>

        <form className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <Button type="submit" className="w-full">
            Kirim link reset
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/login" className="text-blue-400 hover:underline">
            Kembali ke login
          </Link>
        </p>
      </div>
    </main>
  );
}
