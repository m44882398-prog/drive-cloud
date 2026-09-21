import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Client untuk DB data dasar: auth, config, kategori, dan daftar DB cloud. */
export function createBaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_BASE_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_BASE_SUPABASE_URL dan NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY wajib diisi.');
    }

    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
