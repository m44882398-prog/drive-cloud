'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ProjectCreateButton({ databaseId }: { databaseId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const formData = new FormData(event.currentTarget)
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          database_id: databaseId,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? 'Gagal membuat project.')
        return
      }

      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Buat Project Baru</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="project-form-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="project-form-title" className="text-xl font-semibold">Buat Project Baru</h2>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Tutup</Button>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium">Nama project
                <input name="name" required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium">Deskripsi (opsional)
                <textarea name="description" rows={3} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Membuat...' : 'Buat Project'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
