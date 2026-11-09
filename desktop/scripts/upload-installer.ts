import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { readdir, stat } from 'fs/promises'
import path from 'path'

async function main() {
  const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL
  const serviceKey = process.env.BASE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_BASE_SUPABASE_URL dan BASE_SUPABASE_SERVICE_ROLE_KEY wajib diatur.')
  }

  const outputDirectory = path.resolve(__dirname, '..', 'release')
  const candidates = await Promise.all((await readdir(outputDirectory))
    .filter((name) => name.toLowerCase().endsWith('.exe') && !name.toLowerCase().includes('uninstaller'))
    .map(async (name) => {
      const filePath = path.join(outputDirectory, name)
      return { filePath, modifiedAt: (await stat(filePath)).mtimeMs }
    }))
  const installer = candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.filePath
  if (!installer) throw new Error(`Installer .exe tidak ditemukan di ${outputDirectory}. Jalankan build dulu.`)

  const version = process.env.npm_package_version ?? '1.0.0'
  const objectPath = `desktop/${version}/${path.basename(installer)}`
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await supabase.storage.from('installers').upload(objectPath, createReadStream(installer), {
    contentType: 'application/vnd.microsoft.portable-executable',
    upsert: true,
  })
  if (error) throw new Error(`Upload installer gagal: ${error.message}`)

  console.log(`Installer uploaded: installers/${objectPath}`)
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause)
  process.exitCode = 1
})
