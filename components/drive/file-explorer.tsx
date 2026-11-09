'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Folder = { id: string; name: string }
type DriveFile = { id: string; name: string; size: number | null }
type FolderTrail = Folder

export function FileExplorer({
  databaseId,
  projectId,
}: {
  databaseId: string
  projectId: string
}) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [trail, setTrail] = useState<FolderTrail[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [folderName, setFolderName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const query = `database_id=${encodeURIComponent(databaseId)}&projectId=${encodeURIComponent(projectId)}`

  const loadItems = useCallback(async () => {
    setError('')
    try {
      const folderQuery = folderId ? `&parentId=${encodeURIComponent(folderId)}` : ''
      const fileQuery = folderId ? `&folderId=${encodeURIComponent(folderId)}` : ''
      const [folderResponse, fileResponse] = await Promise.all([
        fetch(`/api/folders?${query}${folderQuery}`),
        fetch(`/api/files?${query}${fileQuery}`),
      ])
      const folderData = await folderResponse.json()
      const fileData = await fileResponse.json()

      if (!folderResponse.ok) {
        setError(folderData.error ?? 'Gagal memuat folder.')
        return
      }
      if (!fileResponse.ok) {
        setError(fileData.error ?? 'Gagal memuat file.')
        return
      }

      setFolders(folderData)
      setFiles(fileData)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat isi folder.')
    }
  }, [folderId, query])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!folderName.trim()) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: folderName.trim(),
          parent_id: folderId,
          database_id: databaseId,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Gagal membuat folder.')
        return
      }
      setFolderName('')
      await loadItems()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat folder.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const selectedFile = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0]
    if (!selectedFile) return

    setBusy(true)
    setError('')
    const body = new FormData()
    body.set('file', selectedFile)
    body.set('projectId', projectId)
    body.set('database_id', databaseId)
    if (folderId) body.set('folderId', folderId)

    try {
      const response = await fetch('/api/files/upload', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Gagal upload file.')
        return
      }
      form.reset()
      await loadItems()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal upload file.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadFile(fileId: string) {
    setError('')
    try {
      const response = await fetch(`/api/files/${fileId}/download?database_id=${encodeURIComponent(databaseId)}`)
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Gagal menyiapkan download.')
        return
      }
      window.location.assign(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyiapkan download.')
    }
  }

  async function removeItem(path: string, itemId: string, label: string) {
    if (!window.confirm(`Hapus ${label} ini?`)) return
    try {
      const response = await fetch(`${path}/${itemId}?database_id=${encodeURIComponent(databaseId)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? `Gagal menghapus ${label}.`)
        return
      }
      await loadItems()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Gagal menghapus ${label}.`)
    }
  }

  function openFolder(folder: Folder) {
    setTrail((current) => [...current, folder])
    setFolderId(folder.id)
  }

  function goToTrail(index: number) {
    const nextTrail = trail.slice(0, index)
    setTrail(nextTrail)
    setFolderId(nextTrail.at(-1)?.id ?? null)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
          <Link href={`/drive/${databaseId}`} className="hover:text-blue-600">Projects</Link>
          <span>›</span>
          <button type="button" onClick={() => goToTrail(0)} className="hover:text-blue-600">Root</button>
          {trail.map((folder, index) => (
            <span key={folder.id} className="flex items-center gap-2">
              <span>›</span>
              {index === trail.length - 1 ? <span>{folder.name}</span> : (
                <button type="button" onClick={() => goToTrail(index + 1)} className="hover:text-blue-600">{folder.name}</button>
              )}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={createFolder} className="flex gap-2">
            <input aria-label="Nama folder baru" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Nama folder" className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <Button type="submit" variant="outline" disabled={busy || !folderName.trim()}>Buat Folder</Button>
          </form>
          <form onSubmit={uploadFile} className="flex items-center gap-2">
            <input aria-label="Pilih file untuk diupload" type="file" required className="max-w-52 text-sm" />
            <Button type="submit" disabled={busy}>{busy ? 'Memproses...' : 'Upload'}</Button>
          </form>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {folders.length === 0 && files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
          <h2 className="font-semibold">Folder ini masih kosong</h2>
          <p className="mt-2 text-sm text-slate-500">Upload file atau buat folder baru untuk memulai.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {folders.map((folder) => (
            <li key={folder.id} className="flex items-center justify-between py-3">
              <button type="button" onClick={() => openFolder(folder)} className="font-medium text-blue-700 hover:underline">📁 {folder.name}</button>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem('/api/folders', folder.id, 'folder')}>Hapus</Button>
            </li>
          ))}
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between py-3">
              <div>
                <span className="font-medium">{file.name}</span>
                <span className="ml-3 text-xs text-slate-500">{formatBytes(file.size ?? 0)}</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void downloadFile(file.id)}>Download</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void removeItem('/api/files', file.id, 'file')}>Hapus</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
