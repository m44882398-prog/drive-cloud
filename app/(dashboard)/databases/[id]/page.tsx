import { redirect } from 'next/navigation'

export default function LegacyDatabasePage({ params }: { params: { id: string } }) {
  redirect(`/drive/${params.id}`)
}
