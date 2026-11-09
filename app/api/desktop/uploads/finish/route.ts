import { NextResponse } from 'next/server'
import { getDesktopContext } from '@/lib/supabase/desktop-auth'

export async function POST(request: Request) {
  try {
    const { databaseId, projectId, filePath, storagePath, size, contentType, ifMatch, checksum } = await request.json()
    if (!databaseId || !projectId || !Array.isArray(filePath) || !storagePath) {
      return NextResponse.json({ error: 'Data upload tidak lengkap.' }, { status: 400 })
    }
    const { client, user } = await getDesktopContext(request, databaseId)
    if (
      !filePath.every((segment: unknown) => typeof segment === 'string' && segment.length > 0 && segment !== '.' && segment !== '..' && !/[\\/\0]/.test(segment)) ||
      typeof storagePath !== 'string' ||
      !storagePath.startsWith(`${user.id}/${projectId}/`)
    ) {
      return NextResponse.json({ error: 'Path upload tidak valid.' }, { status: 400 })
    }
    const { data: project, error: projectError } = await client.from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projectError) throw new Error(projectError.message)
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })
    const fileName = String(filePath[filePath.length - 1])
    let parentId: string | null = null
    for (const rawName of filePath.slice(0, -1)) {
      let query = client.from('folders').select('id').eq('project_id', projectId).eq('name', String(rawName))
      query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)
      const { data: folder, error } = await query.maybeSingle()
      if (error) throw new Error(error.message)
      if (!folder) return NextResponse.json({ error: 'Folder induk tidak ditemukan.' }, { status: 404 })
      parentId = folder.id
    }

    let existingQuery = client.from('files')
      .select('id, storage_path, checksum')
      .eq('project_id', projectId)
      .eq('name', fileName)
      .eq('is_trashed', false)
    existingQuery = parentId ? existingQuery.eq('folder_id', parentId) : existingQuery.is('folder_id', null)
    const { data: existing, error: existingError } = await existingQuery.maybeSingle()
    if (existingError) throw new Error(existingError.message)

    const conflict = Boolean(existing && ifMatch && ifMatch !== '*' && ifMatch !== `"${existing.checksum}"`)
    const conflictName = conflict ? String(filePath.at(-1)) + `.conflict-${new Date().toISOString().replace(/[:.]/g, '-')}` : fileName
    const metadata = {
      project_id: projectId,
      folder_id: parentId,
      name: conflictName,
      size: Number(size) || 0,
      mime_type: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      extension: conflictName.includes('.') ? conflictName.split('.').pop() : null,
      storage_path: storagePath,
      checksum: typeof checksum === 'string' ? checksum : null,
      is_trashed: false,
      trashed_at: null,
      updated_at: new Date().toISOString(),
    }

    const { data: file, error } = existing && !conflict
      ? await client.from('files').update(metadata).eq('id', existing.id).select('id').single()
      : await client.from('files').insert(metadata).select('id').single()
    if (error) throw new Error(error.message)

    if (existing && !conflict) {
      const { error: cleanupError } = await client.storage.from('drive-files').remove([existing.storage_path])
      if (cleanupError) {
        console.error('Desktop upload saved but old storage object cleanup failed:', cleanupError.message)
        return NextResponse.json({
          id: file.id,
          name: conflictName,
          conflict,
          warning: `File lama gagal dibersihkan: ${cleanupError.message}`,
        }, { status: 201 })
      }
    }
    return NextResponse.json({ id: file.id, name: conflictName, conflict })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Tidak bisa menyelesaikan upload.'
    const status = message === 'UNAUTHORIZED' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
