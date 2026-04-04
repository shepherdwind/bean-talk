import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter } from 'grammy';
import { logger } from '../utils/logger';

export class FileSessionStorage<T> implements StorageAdapter<T> {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  private filePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safeKey}.json`);
  }

  read(key: string): T | undefined {
    try {
      const data = fs.readFileSync(this.filePath(key), 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return undefined;
    }
  }

  write(key: string, value: T): void {
    try {
      fs.writeFileSync(this.filePath(key), JSON.stringify(value), 'utf-8');
    } catch (error) {
      logger.error(`Error writing session for key ${key}:`, error);
    }
  }

  delete(key: string): void {
    try {
      fs.unlinkSync(this.filePath(key));
    } catch {
      // File may not exist, ignore
    }
  }
}
