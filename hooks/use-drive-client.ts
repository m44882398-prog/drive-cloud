'use client';

import { useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type DriveDatabase = {
  supabase_url: string;
  supabase_anon_key: string;
};

/** Memuat client browser untuk DB cloud yang dipilih user. */
export function useDriveClient(databaseId: string | null) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(Boolean(databaseId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!databaseId) {
        setClient(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/databases/${databaseId}`);
        if (!response.ok) throw new Error('Database cloud tidak dapat diakses.');
        const database = (await response.json()) as DriveDatabase;
        const nextClient = createClient(database.supabase_url, database.supabase_anon_key);
        if (!cancelled) setClient(nextClient);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat database cloud.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [databaseId]);

  return { client, loading, error };
}
