import { createHash } from 'crypto'
import { getDesktopContext } from '@/lib/supabase/desktop-auth'

type RouteContext = {
  params: { databaseId: string; projectId: string; path?: string[] }
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]!)
}

function multistatus(entries: Array<{ href: string; name: string; directory: boolean; size?: number; etag?: string }>) {
  const responses = entries.map(({ href, name, directory, size, etag }) => {
    const resourceType = directory ? '<d:collection/>' : ''
    const length = directory ? '' : `<d:getcontentlength>${size ?? 0}</d:getcontentlength>`
    const etagXml = etag ? `<d:getetag>${xmlEscape(etag)}</d:getetag>` : ''
    return `<d:response><d:href>${xmlEscape(href)}</d:href><d:propstat><d:prop><d:displayname>${xmlEscape(name)}</d:displayname><d:resourcetype>${resourceType}</d:resourcetype>${length}${etagXml}<d:getlastmodified>${new Date().toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`
  }).join('')

  return `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:">${responses}</d:multistatus>`
}

function pathHref(suffix: string[] = []) {
  return `/${suffix.map(encodeURIComponent).join('/')}${suffix.length ? '/' : ''}`
}

async function load(request: Request, context: RouteContext) {
  const { client, user } = await getDesktopContext(request, context.params.databaseId)
  const { data: project, error } = await client.from('projects')
    .select('id')
    .eq('id', context.params.projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!project) throw new Error('Project tidak ditemukan.')
  return { client, projectId: project.id, path: context.params.path ?? [] }
}

async function resolveParent(client: Awaited<ReturnType<typeof load>>['client'], projectId: string, segments: string[]) {
  let parentId: string | null = null
  for (const name of segments) {
    let query = client.from('folders')
      .select('id')
      .eq('project_id', projectId)
    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)
    const { data, error } = await query.eq('name', name)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return { parentId, missing: true }
    parentId = data.id
  }
  return { parentId, missing: false }
}

async function propfind(request: Request, context: RouteContext) {
  const { client, projectId, path } = await load(request, context)
  const { parentId, missing } = await resolveParent(client, projectId, path)
  if (missing) return new Response('Not Found', { status: 404 })

  const currentHref = pathHref(path)
  const entries: Array<{ href: string; name: string; directory: boolean; size?: number; etag?: string }> = [
    { href: currentHref, name: path.at(-1) ?? '', directory: true },
  ]
  const depth = request.headers.get('depth') ?? '1'

  if (depth !== '0') {
    let foldersQuery = client.from('folders').select('id, name').eq('project_id', projectId)
    let filesQuery = client.from('files').select('id, name, size, checksum').eq('project_id', projectId).eq('is_trashed', false)
    foldersQuery = parentId ? foldersQuery.eq('parent_id', parentId) : foldersQuery.is('parent_id', null)
    filesQuery = parentId ? filesQuery.eq('folder_id', parentId) : filesQuery.is('folder_id', null)
    const [{ data: folders, error: foldersError }, { data: files, error: filesError }] = await Promise.all([
      foldersQuery,
      filesQuery,
    ])
    if (foldersError) throw new Error(foldersError.message)
    if (filesError) throw new Error(filesError.message)

    for (const folder of folders ?? []) {
      entries.push({       href: pathHref([...path, folder.name]), name: folder.name, directory: true })
    }
    for (const file of files ?? []) {
      entries.push({
        href: pathHref([...path, file.name]),
        name: file.name,
        directory: false,
        size: file.size ?? 0,
        etag: file.checksum ? `"${file.checksum}"` : undefined,
      })
    }
  }

  return new Response(multistatus(entries), {
    status: 207,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', DAV: '1, 2' },
  })
}

async function getFile(request: Request, context: RouteContext, headOnly = false) {
  const { client, projectId, path } = await load(request, context)
  if (path.length === 0) return new Response('Method Not Allowed', { status: 405 })
  const { parentId, missing } = await resolveParent(client, projectId, path.slice(0, -1))
  if (missing) return new Response('Not Found', { status: 404 })
  let fileQuery = client.from('files')
    .select('id, name, size, mime_type, storage_path, checksum')
    .eq('project_id', projectId)
    .eq('name', path.at(-1)!)
    .eq('is_trashed', false)
  fileQuery = parentId ? fileQuery.eq('folder_id', parentId) : fileQuery.is('folder_id', null)
  const { data: file, error } = await fileQuery.maybeSingle()
  if (error) throw new Error(error.message)
  if (!file) return new Response('Not Found', { status: 404 })

  const headers = {
    'Content-Type': file.mime_type ?? 'application/octet-stream',
    'Content-Length': String(file.size ?? 0),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    ...(file.checksum ? { ETag: `"${file.checksum}"` } : {}),
  }
  if (headOnly) return new Response(null, { headers })

  const { data, error: storageError } = await client.storage.from('drive-files').download(file.storage_path)
  if (storageError) throw new Error(storageError.message)
  return new Response(data, { headers })
}

async function putFile(request: Request, context: RouteContext) {
  const { client, projectId, path } = await load(request, context)
  if (path.length === 0) return new Response('Bad Request', { status: 400 })
  const { parentId, missing } = await resolveParent(client, projectId, path.slice(0, -1))
  if (missing) return new Response('Parent folder not found', { status: 409 })

  const name = path.at(-1)!
  let existingQuery = client.from('files')
    .select('id, storage_path, checksum')
    .eq('project_id', projectId)
    .eq('name', name)
    .eq('is_trashed', false)
  existingQuery = parentId ? existingQuery.eq('folder_id', parentId) : existingQuery.is('folder_id', null)
  const { data: existing, error: existingError } = await existingQuery.maybeSingle()
  if (existingError) throw new Error(existingError.message)

  const bytes = await request.arrayBuffer()
  const checksum = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const ifMatch = request.headers.get('if-match')
  const hasConflict = Boolean(existing && ifMatch && ifMatch !== '*' && ifMatch !== `"${existing.checksum}"`)
  const conflictName = hasConflict
    ? `${name}.conflict-${new Date().toISOString().replace(/[:.]/g, '-')}`
    : name
  const storagePath = existing && !hasConflict
    ? existing.storage_path
    : `${projectId}/${crypto.randomUUID()}/${conflictName}`
  const contentType = request.headers.get('content-type') ?? 'application/octet-stream'
  const { error: storageError } = await client.storage.from('drive-files').upload(storagePath, new Blob([bytes], { type: contentType }), {
    upsert: Boolean(existing),
    contentType,
  })
  if (storageError) throw new Error(storageError.message)

  const fileData = {
    project_id: projectId,
    folder_id: parentId,
    name: conflictName,
    size: bytes.byteLength,
    mime_type: contentType,
    extension: name.includes('.') ? name.split('.').pop() : null,
    storage_path: storagePath,
    checksum,
    is_trashed: false,
    trashed_at: null,
    updated_at: new Date().toISOString(),
  }
  const { error } = existing && !hasConflict
    ? await client.from('files').update(fileData).eq('id', existing.id)
    : await client.from('files').insert(fileData)
  if (error) throw new Error(error.message)
  return new Response(null, {
    status: existing && !hasConflict ? 204 : 201,
    headers: hasConflict ? { 'X-Cloud-Drive-Conflict': encodeURIComponent(conflictName) } : undefined,
  })
}

async function makeCollection(request: Request, context: RouteContext) {
  const { client, projectId, path } = await load(request, context)
  if (path.length === 0) return new Response('Method Not Allowed', { status: 405 })
  const { parentId, missing } = await resolveParent(client, projectId, path.slice(0, -1))
  if (missing) return new Response('Parent folder not found', { status: 409 })
  const { error } = await client.from('folders').insert({
    project_id: projectId,
    parent_id: parentId,
    name: path.at(-1),
  })
  if (error) return new Response(error.message, { status: 405 })
  return new Response(null, { status: 201 })
}

async function deletePath(request: Request, context: RouteContext) {
  const { client, projectId, path } = await load(request, context)
  if (path.length === 0) return new Response('Method Not Allowed', { status: 405 })
  const { parentId, missing } = await resolveParent(client, projectId, path.slice(0, -1))
  if (missing) return new Response('Not Found', { status: 404 })
  const name = path.at(-1)!

  let fileQuery = client.from('files')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', name)
    .eq('is_trashed', false)
  fileQuery = parentId ? fileQuery.eq('folder_id', parentId) : fileQuery.is('folder_id', null)
  const { data: file, error: fileError } = await fileQuery.maybeSingle()
  if (fileError) throw new Error(fileError.message)
  if (file) {
    const { error } = await client.from('files').update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq('id', file.id)
    if (error) throw new Error(error.message)
    return new Response(null, { status: 204 })
  }

  let folderQuery = client.from('folders')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', name)
  folderQuery = parentId ? folderQuery.eq('parent_id', parentId) : folderQuery.is('parent_id', null)
  const { data: folder, error: folderError } = await folderQuery.maybeSingle()
  if (folderError) throw new Error(folderError.message)
  if (!folder) return new Response('Not Found', { status: 404 })

  const [{ count: folderCount }, { count: fileCount }] = await Promise.all([
    client.from('folders').select('id', { count: 'exact', head: true }).eq('parent_id', folder.id),
    client.from('files').select('id', { count: 'exact', head: true }).eq('folder_id', folder.id).eq('is_trashed', false),
  ])
  if ((folderCount ?? 0) > 0 || (fileCount ?? 0) > 0) return new Response('Directory not empty', { status: 409 })
  const { error } = await client.from('folders').delete().eq('id', folder.id)
  if (error) throw new Error(error.message)
  return new Response(null, { status: 204 })
}

async function movePath(request: Request, context: RouteContext) {
  const { client, projectId, path: sourcePath } = await load(request, context)
  const destinationHeader = request.headers.get('destination')
  if (!destinationHeader || sourcePath.length === 0) return new Response('Bad Request', { status: 400 })

  const destination = new URL(destinationHeader)
  const current = new URL(request.url)
  const basePrefix = `/api/desktop/webdav/${context.params.databaseId}/${context.params.projectId}`
  if (destination.origin !== current.origin || !destination.pathname.startsWith(basePrefix)) {
    return new Response('Cross-project move is not supported', { status: 400 })
  }
  const targetPath = destination.pathname.slice(basePrefix.length).split('/').filter(Boolean).map(decodeURIComponent)
  if (targetPath.length === 0) return new Response('Bad Request', { status: 400 })

  const sourceParent = await resolveParent(client, projectId, sourcePath.slice(0, -1))
  const targetParent = await resolveParent(client, projectId, targetPath.slice(0, -1))
  if (sourceParent.missing || targetParent.missing) return new Response('Parent folder not found', { status: 409 })
  const sourceName = sourcePath.at(-1)!
  const targetName = targetPath.at(-1)!

  let fileQuery = client.from('files')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', sourceName)
    .eq('is_trashed', false)
  fileQuery = sourceParent.parentId ? fileQuery.eq('folder_id', sourceParent.parentId) : fileQuery.is('folder_id', null)
  const { data: file, error: fileError } = await fileQuery.maybeSingle()
  if (fileError) throw new Error(fileError.message)
  if (file) {
    let targetFileQuery = client.from('files')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', targetName)
      .eq('is_trashed', false)
      .neq('id', file.id)
    targetFileQuery = targetParent.parentId ? targetFileQuery.eq('folder_id', targetParent.parentId) : targetFileQuery.is('folder_id', null)
    const { data: targetFile, error: targetFileError } = await targetFileQuery.maybeSingle()
    if (targetFileError) throw new Error(targetFileError.message)
    if (targetFile && request.headers.get('overwrite') === 'F') return new Response('Destination exists', { status: 412 })
    if (targetFile) {
      const { error } = await client.from('files')
        .update({ is_trashed: true, trashed_at: new Date().toISOString() })
        .eq('id', targetFile.id)
      if (error) throw new Error(error.message)
    }
    const { error } = await client.from('files').update({ folder_id: targetParent.parentId, name: targetName }).eq('id', file.id)
    if (error) throw new Error(error.message)
    return new Response(null, { status: 201 })
  }

  let sourceFolderQuery = client.from('folders')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', sourceName)
  sourceFolderQuery = sourceParent.parentId ? sourceFolderQuery.eq('parent_id', sourceParent.parentId) : sourceFolderQuery.is('parent_id', null)
  const { data: folder, error: folderError } = await sourceFolderQuery.maybeSingle()
  if (folderError) throw new Error(folderError.message)
  if (!folder) return new Response('Not Found', { status: 404 })

  const isMovingIntoDescendant = targetPath.length > sourcePath.length &&
    sourcePath.every((segment, index) => targetPath[index] === segment)
  if (isMovingIntoDescendant) return new Response('Invalid move', { status: 409 })

  let targetFolderQuery = client.from('folders')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', targetName)
    .neq('id', folder.id)
  targetFolderQuery = targetParent.parentId ? targetFolderQuery.eq('parent_id', targetParent.parentId) : targetFolderQuery.is('parent_id', null)
  const { data: targetFolder, error: targetFolderError } = await targetFolderQuery.maybeSingle()
  if (targetFolderError) throw new Error(targetFolderError.message)
  if (targetFolder && request.headers.get('overwrite') === 'F') return new Response('Destination exists', { status: 412 })
  if (targetFolder) {
    const [{ count: childFolders }, { count: childFiles }] = await Promise.all([
      client.from('folders').select('id', { count: 'exact', head: true }).eq('parent_id', targetFolder.id),
      client.from('files').select('id', { count: 'exact', head: true }).eq('folder_id', targetFolder.id),
    ])
    if ((childFolders ?? 0) || (childFiles ?? 0)) return new Response('Destination directory not empty', { status: 409 })
    const { error } = await client.from('folders').delete().eq('id', targetFolder.id)
    if (error) throw new Error(error.message)
  }
  const { error } = await client.from('folders').update({ parent_id: targetParent.parentId, name: targetName }).eq('id', folder.id)
  if (error) throw new Error(error.message)
  return new Response(null, { status: 201 })
}

async function handle(request: Request, context: RouteContext) {
  try {
    const method = request.headers.get('x-cloud-drive-webdav-method') ?? request.method
    switch (method) {
      case 'OPTIONS':
        return new Response(null, { status: 200, headers: { DAV: '1, 2', Allow: 'OPTIONS, PROPFIND, GET, HEAD, PUT, MKCOL, DELETE, MOVE' } })
      case 'PROPFIND':
        return await propfind(request, context)
      case 'GET':
        return await getFile(request, context)
      case 'HEAD':
        return await getFile(request, context, true)
      case 'PUT':
        return await putFile(request, context)
      case 'MKCOL':
        return await makeCollection(request, context)
      case 'DELETE':
        return await deletePath(request, context)
      case 'MOVE':
        return await movePath(request, context)
      default:
        return new Response('Method Not Allowed', { status: 405 })
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'WebDAV request failed.'
    const status = message === 'UNAUTHORIZED' ? 401 : message.includes('tidak ditemukan') ? 404 : 500
    return new Response(message, { status })
  }
}

export const POST = handle
