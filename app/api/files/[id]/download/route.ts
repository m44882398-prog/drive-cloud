import { NextResponse } from 'next/server'
import { getDriveContext } from '@/lib/supabase/drive-context'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { client, user } = await getDriveContext(new URL(request.url).searchParams.get('database_id'))
    const { data: file, error: fileError } = await client
      .from('files')
      .select('storage_path, project_id, name')
      .eq('id', params.id)
      .maybeSingle()

    if (fileError) return NextResponse.json({ error: fileError.message }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })

    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id')
      .eq('id', file.project_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 })
    if (!project) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })

    const { data, error } = await client.storage
      .from('drive-files')
      .createSignedUrl(file.storage_path, 60, { download: file.name })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ url: data.signedUrl })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal menyiapkan download.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
