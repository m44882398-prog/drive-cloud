export class SyncEngine {
  public async syncNow() {
    return { success: true, synced: 0 };
  }

  public async queueUpload() {
    return { queued: true };
  }
}
