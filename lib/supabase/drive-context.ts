import { createServerSupabaseClient } from './server';
import { driveManager } from './drive-manager';

export async function getDriveContext(databaseId: string | null) {
  const auth = createServerSupabaseClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();

  if (authError || !user) throw new Error('UNAUTHORIZED');
  if (!databaseId) throw new Error('DATABASE_ID_REQUIRED');

  const client = await driveManager.getClient(databaseId, user.id);
  return { client, user };
}
