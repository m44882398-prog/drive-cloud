import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './admin';

type DatabaseRecord = {
  id: string;
  user_id: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key?: string | null;
  is_active: boolean;
};

/** Mengelola koneksi ter-cache ke DB cloud yang tersimpan di DB dasar. */
class DriveManager {
  private clients = new Map<string, SupabaseClient>();

  async getClient(databaseId: string, userId?: string): Promise<SupabaseClient> {
    let query = supabaseAdmin.from('databases').select('*').eq('id', databaseId).eq('is_active', true);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query.single<DatabaseRecord>();
    if (error || !data) throw new Error(error?.message ?? 'Database cloud tidak ditemukan.');
    if (!data.supabase_service_key) {
      throw new Error('Service role key database cloud belum disimpan. Hapus koneksi ini lalu tambahkan ulang dengan service role key.');
    }

    const cached = this.clients.get(databaseId);
    if (cached) return cached;

    // Service key hanya digunakan di server; endpoint tetap memeriksa kepemilikan user secara eksplisit.
    const client = createClient(data.supabase_url, data.supabase_service_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: connectionError } = await client.from('projects').select('id').limit(1);
    if (connectionError) throw new Error(`Gagal connect ke DB cloud: ${connectionError.message}`);

    this.clients.set(databaseId, client);
    return client;
  }

  clearCache(databaseId?: string) {
    if (databaseId) this.clients.delete(databaseId);
    else this.clients.clear();
  }
}

export const driveManager = new DriveManager();
