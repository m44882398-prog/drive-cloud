import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { createHash } from 'crypto'
import { once } from 'events'
import { Readable, Transform } from 'stream'

type ProxySettings = {
  serverUrl: string
  databaseId: string
  projectId: string
  token: string
}

function readToken(request: IncomingMessage) {
  const authorization = request.headers.authorization ?? ''
  if (!authorization.startsWith('Basic ')) return null
  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
  const separator = credentials.indexOf(':')
  if (separator < 0 || credentials.slice(0, separator) !== 'cloud-drive') return null
  return credentials.slice(separator + 1)
}

export class WebDavProxy {
  private server: Server | null = null
  private settings: ProxySettings
  private port = 0

  constructor(settings: ProxySettings) {
    this.settings = settings
  }

  updateToken(token: string) {
    this.settings.token = token
  }

  async start() {
    if (this.server) return this.port
    this.server = createServer((request, response) => {
      void this.handle(request, response)
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.removeListener('error', reject)
        const address = this.server!.address()
        if (!address || typeof address === 'string') {
          reject(new Error('Tidak bisa mendapatkan port WebDAV lokal.'))
          return
        }
        this.port = address.port
        resolve()
      })
    })
    return this.port
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    const token = readToken(request)
    if (!token || token !== this.settings.token) {
      response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Cloud Drive"' })
      response.end('Unauthorized')
      return
    }

    try {
      const webdavMethod = request.method ?? 'GET'
      const prefix = `/api/desktop/webdav/${encodeURIComponent(this.settings.databaseId)}/${encodeURIComponent(this.settings.projectId)}`
      const localUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
      const localPath = localUrl.pathname
      if (webdavMethod === 'PUT') {
        await this.uploadFile(request, response, localPath)
        return
      }
      const remoteUrl = new URL(`${prefix}${localPath === '/' ? '' : localPath}`, this.settings.serverUrl)
      const headers = new Headers({
        Authorization: `Bearer ${this.settings.token}`,
        'x-cloud-drive-webdav-method': webdavMethod,
      })
      for (const name of ['depth', 'content-type', 'overwrite', 'if', 'if-match', 'if-none-match']) {
        const value = request.headers[name]
        if (typeof value === 'string') headers.set(name, value)
      }

      const destination = request.headers.destination
      if (typeof destination === 'string') {
        const destinationPath = new URL(destination).pathname
        const mappedPath = `${prefix}${destinationPath === '/' ? '' : destinationPath}`
        headers.set('destination', new URL(mappedPath, this.settings.serverUrl).toString())
      }

      const hasBody = !['GET', 'HEAD'].includes(webdavMethod)
      const init: RequestInit = {
        method: 'POST',
        headers,
        body: hasBody ? Readable.toWeb(request) as unknown as BodyInit : undefined,
      }
      if (hasBody) Object.assign(init, { duplex: 'half' })
      const remoteResponse = await fetch(remoteUrl, init)
      const responseHeaders: Record<string, string> = {}
      for (const [name, value] of remoteResponse.headers) {
        if (!['transfer-encoding', 'connection', 'content-encoding'].includes(name.toLowerCase())) {
          responseHeaders[name] = value
        }
      }
      response.writeHead(remoteResponse.status, responseHeaders)
      if (!remoteResponse.body) {
        response.end()
        return
      }
      Readable.fromWeb(remoteResponse.body as unknown as import('stream/web').ReadableStream).pipe(response)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'WebDAV proxy failed.'
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(message)
    }
  }

  private async uploadFile(request: IncomingMessage, response: ServerResponse, localPath: string) {
    const filePath = localPath.split('/').filter(Boolean).map(decodeURIComponent)
    if (!filePath.length) {
      response.writeHead(400)
      response.end('File path is required.')
      return
    }

    const apiHeaders = {
      Authorization: `Bearer ${this.settings.token}`,
      'Content-Type': 'application/json',
    }
    const startResponse = await fetch(new URL('/api/desktop/uploads/start', this.settings.serverUrl), {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        databaseId: this.settings.databaseId,
        projectId: this.settings.projectId,
        filePath,
        size: Number(request.headers['content-length'] ?? 0),
        contentType: request.headers['content-type'] ?? 'application/octet-stream',
        ifMatch: request.headers['if-match'] ?? null,
      }),
    })
    const upload = await startResponse.json() as {
      uploadUrl?: string
      anonKey?: string
      storagePath?: string
      fileName?: string
      size?: number
      contentType?: string
      parentId?: string | null
      ifMatch?: string | null
      error?: string
    }
    if (!startResponse.ok || !upload.uploadUrl || !upload.storagePath || !upload.anonKey) {
      response.writeHead(startResponse.status, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(upload.error ?? 'Could not start storage upload.')
      return
    }

    const digest = createHash('sha256')
    const hashingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        digest.update(chunk)
        callback(null, chunk)
      },
    })
    request.pipe(hashingStream)
    let uploaded = false
    try {
      const uploadInit: RequestInit = {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${upload.anonKey}`,
          'Content-Type': upload.contentType ?? request.headers['content-type'] ?? 'application/octet-stream',
          'x-upsert': 'false',
        },
        body: Readable.toWeb(hashingStream) as unknown as BodyInit,
      }
      Object.assign(uploadInit, { duplex: 'half' })
      const storageResponse = await fetch(upload.uploadUrl, uploadInit)
      if (!storageResponse.ok) {
        const message = await storageResponse.text()
        throw new Error(`Storage upload failed (${storageResponse.status}): ${message}`)
      }
      await once(hashingStream, 'end')
      uploaded = true

      const finishResponse = await fetch(new URL('/api/desktop/uploads/finish', this.settings.serverUrl), {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          databaseId: this.settings.databaseId,
          projectId: this.settings.projectId,
          filePath,
          storagePath: upload.storagePath,
          size: request.headers['content-length'] ?? upload.size ?? 0,
          contentType: upload.contentType,
          ifMatch: upload.ifMatch,
          checksum: digest.digest('hex'),
        }),
      })
      const result = await finishResponse.json() as { name?: string; conflict?: boolean; error?: string }
      if (!finishResponse.ok) throw new Error(result.error ?? 'Gagal menyimpan metadata file.')
      response.writeHead(201, result.conflict ? { 'X-Cloud-Drive-Conflict': encodeURIComponent(result.name ?? '') } : undefined)
      response.end()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Storage upload failed.'
      if (uploaded) {
        try {
          await fetch(new URL('/api/desktop/uploads/cancel', this.settings.serverUrl), {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ databaseId: this.settings.databaseId, storagePath: upload.storagePath }),
          })
        } catch (cleanupError) {
          console.error('Failed to clean up incomplete desktop upload:', cleanupError)
        }
      }
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(message)
    }
  }

  async stop() {
    const server = this.server
    this.server = null
    this.port = 0
    if (!server) return
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
