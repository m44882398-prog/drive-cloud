import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getDesktopContext } from '@/lib/supabase/desktop-auth'

export async function POST(request: Request) {
  try {
    const { databaseId, projectId, filePath, size, contentType, ifMatch } = await request.json()
    if (!databaseId || !projectId || !Array.isArray(filePath) || filePath.length === 0) {
      return NextResponse.json({ error: 'databaseId, projectId, dan filePath wajib diisi.' }, { status: 400 })
    }
    const fileSize = Number(size ?? 0)
    if (
      !filePath.every((segment) => typeof segment === 'string' && segment.length > 0 && segment !== '.' && segment !== '..' && !/[\\/\0]/.test(segment)) ||
      !Number.isSafeInteger(fileSize) ||
      fileSize < 0 ||
      fileSize > 5 * 1024 * 1024 * 1024
    ) {
      return NextResponse.json({ error: 'Path file atau ukuran file tidak valid.' }, { status: 400 })
    }
    const { client, user } = await getDesktopContext(request, databaseId)
    const { data: project, error: projectError } = await client.from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projectError) throw new Error(projectError.message)
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })

    const fileName = String(filePath[filePath.length - 1])
    const parentSegments = filePath.slice(0, -1).map(String)
    let parentId: string | null = null
    for (const folderName of parentSegments) {
      let folderQuery = client.from('folders').select('id').eq('project_id', projectId).eq('name', folderName)
      folderQuery = parentId ? folderQuery.eq('parent_id', parentId) : folderQuery.is('parent_id', null)
      const { data: folder, error } = await folderQuery.maybeSingle()
      if (error) throw new Error(error.message)
      if (!folder) return NextResponse.json({ error: `Folder "${folderName}" tidak ditemukan.` }, { status: 404 })
      parentId = folder.id
    }

    let fileQuery = client.from('files')
      .select('id, storage_path, checksum')
      .eq('project_id', projectId)
      .eq('name', fileName)
      .eq('is_trashed', false)
    fileQuery = parentId ? fileQuery.eq('folder_id', parentId) : fileQuery.is('folder_id', null)
    const { data: existing, error: existingError } = await fileQuery.maybeSingle()
    if (existingError) throw new Error(existingError.message)

    const conflict = Boolean(existing && ifMatch && ifMatch !== '*' && ifMatch !== `"${existing.checksum}"`)
    const conflictName = conflict
      ? `${fileName}.conflict-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : fileName
    const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}/${conflictName}`
    const { data: signed, error: signedError } = await client.storage
      .from('drive-files')
      .createSignedUploadUrl(storagePath, { upsert: false })
    if (signedError) throw new Error(signedError.message)

    const { data: database, error: dbError } = await supabaseAdmin.from('databases')
      .select('supabase_url, supabase_anon_key')
      .eq('id', databaseId)
      .eq('user_id', user.id)
      .single()
    if (dbError) throw new Error(dbError.message)

    const objectPath = storagePath.split('/').map(encodeURIComponent).join('/')
    const uploadUrl = new URL(`/storage/v1/object/upload/sign/drive-files/${objectPath}`, database.supabase_url)
    uploadUrl.searchParams.set('token', signed.token)

    return NextResponse.json({
      uploadUrl: uploadUrl.toString(),
      anonKey: database.supabase_anon_key,
      storagePath,
      fileName: conflictName,
      parentId,
      size: fileSize,
      contentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      ifMatch: typeof ifMatch === 'string' ? ifMatch : null,
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Tidak bisa memulai upload.'
    const status = message === 'UNAUTHORIZED' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
