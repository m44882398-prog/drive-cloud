'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type DatabaseFormProps = {
  buttonLabel?: string
  className?: string
}

export function DatabaseForm({ buttonLabel = 'Tambah Database', className }: DatabaseFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [s3Endpoint, setS3Endpoint] = useState('')
  const [supabaseUrlError, setSupabaseUrlError] = useState('')

  function updateSupabaseUrl(value: string) {
    setSupabaseUrl(value)
    try {
      const url = parseSupabaseUrl(value)
      setS3Endpoint(`${url.origin}/storage/v1/s3`)
      setSupabaseUrlError('')
    } catch {
      setS3Endpoint('')
      setSupabaseUrlError(value.trim() ? 'Masukkan URL project Supabase HTTPS, contoh https://xxx.supabase.co.' : '')
    }
  }

  function parseSupabaseUrl(value: string) {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/i.test(url.hostname) ||
      url.port ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error('URL bukan URL project Supabase yang valid.')
    }
    return url
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (supabaseUrlError || !s3Endpoint) {
      setError('Masukkan URL project Supabase yang valid sebelum menyimpan.')
      return
    }
    setSaving(true)

    try {
      const formData = new FormData(event.currentTarget)
      const response = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          supabase_url: formData.get('supabase_url'),
          supabase_anon_key: formData.get('supabase_anon_key'),
          supabase_service_key: formData.get('supabase_service_key'),
          s3_access_key: formData.get('s3_access_key'),
          s3_secret_key: formData.get('s3_secret_key'),
          s3_region: formData.get('s3_region'),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? 'Gagal menambahkan database.')
        return
      }

      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menambahkan database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>{buttonLabel}</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="database-form-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="database-form-title" className="text-xl font-semibold">Tambah Database</h2>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Tutup</Button>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium">Nama database
                <input name="name" required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium">URL Supabase
                <input
                  name="supabase_url"
                  type="url"
                  required
                  placeholder="https://project.supabase.co"
                  value={supabaseUrl}
                  onChange={(event) => updateSupabaseUrl(event.target.value)}
                  aria-invalid={Boolean(supabaseUrlError)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                />
                {supabaseUrlError && <span role="alert" className="mt-1 block text-xs text-red-600">{supabaseUrlError}</span>}
                <span className="mt-1 block text-xs font-normal text-slate-500">Preview endpoint S3
                  <input
                    aria-label="Preview endpoint S3"
                    readOnly
                    value={s3Endpoint}
                    placeholder="Isi URL Supabase untuk melihat endpoint."
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2"
                  />
                </span>
              </label>
              <label className="block text-sm font-medium">Supabase anon key
                <input name="supabase_anon_key" type="password" required autoComplete="off" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium">Supabase service role key
                <input name="supabase_service_key" type="password" required autoComplete="off" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <p className="-mt-2 text-xs text-slate-500">
                Diperlukan agar server dapat mengakses project cloud yang memakai RLS. Key ini dikirim hanya ke API server dan tidak ditampilkan kembali.
              </p>
              <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold">S3 Configuration</legend>
                <label className="block text-sm font-medium">Access Key ID
                  <input name="s3_access_key" required autoComplete="off" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-medium">Secret Access Key
                  <input name="s3_secret_key" type="password" required autoComplete="new-password" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>
                <label className="block text-sm font-medium">Region
                  <input name="s3_region" required defaultValue="ap-southeast-2" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>
                <p className="text-xs text-slate-500">
                  S3 credentials hanya disajikan ke desktop client yang sudah login; secret key tidak dikirim ke halaman web setelah disimpan.
                </p>
              </fieldset>
              <label className="block text-sm font-medium">Deskripsi (opsional)
                <textarea name="description" rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Database'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
