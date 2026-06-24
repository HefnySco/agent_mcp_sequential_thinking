import type { IStorageAdapter } from './IStorageAdapter.js';
import type { StorageBackend } from '../types.js';
import { JsonStorageAdapter } from './JsonStorageAdapter.js';
import { SqliteStorageAdapter } from './SqliteStorageAdapter.js';

/**
 * Factory for creating storage adapters
 */
export class StorageFactory {
  /**
   * Create a storage adapter based on the backend type
   * @param backend - The storage backend type
   * @param storagePath - The path to the storage file/database
   * @returns A storage adapter instance
   */
  static createAdapter(backend: StorageBackend, storagePath: string): IStorageAdapter {
    switch (backend) {
      case 'json':
        return new JsonStorageAdapter(storagePath);
      case 'sqlite':
        return new SqliteStorageAdapter(storagePath);
      default:
        throw new Error(`Unsupported storage backend: ${backend}`);
    }
  }
}
