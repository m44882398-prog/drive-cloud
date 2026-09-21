export default function PublicSharePage({ params }: { params: { token: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-sm text-blue-300">Shared File</p>
        <h1 className="mt-4 text-3xl font-bold">Brand Guide.pdf</h1>
        <p className="mt-3 text-slate-400">Token: {params.token}</p>
        <p className="mt-6 text-slate-300">File ini dibagikan untuk di-download publik. Link berlaku sesuai konfigurasi expiry.</p>
      </div>
    </main>
  );
}
