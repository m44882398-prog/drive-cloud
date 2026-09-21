import { NextResponse } from 'next/server';
import { getDriveContext } from '@/lib/supabase/drive-context';

export async function POST(request: Request) {
  try {
    const { file_id, expires_at, database_id: databaseId } = await request.json();
    const { client: supabase, user } = await getDriveContext(databaseId);

    const token = crypto.randomUUID();

    const { data, error } = await supabase
      .from('shared_links')
      .insert({
        file_id,
        token,
        expires_at: expires_at ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ link: `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}?database_id=${databaseId}`, data });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat share link.' }, { status: 500 });
  }
}
