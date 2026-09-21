export class DriveManager {
  public async listDirectory(path: string) {
    return { path, entries: [] };
  }

  public async readFile(path: string) {
    return { path, content: null };
  }

  public async createDirectory(path: string) {
    return { path };
  }
}
