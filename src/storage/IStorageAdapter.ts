import type {
  Task,
  SequentialState,
  Workflow,
  WorkflowRun
} from '../types.js';

/**
 * Abstract storage adapter interface
 * Defines the contract for different storage backends
 */
export interface IStorageAdapter {
  /**
   * Load state from storage
   * @returns The loaded state
   */
  load(): Promise<SequentialState>;

  /**
   * Save state to storage
   * @param state - The state to save
   */
  save(state: SequentialState): Promise<void>;

  /**
   * Initialize the storage backend
   * Called once when the adapter is first created
   */
  initialize(): Promise<void>;

  /**
   * Close the storage backend
   * Called when shutting down
   */
  close(): Promise<void>;

  /**
   * Clear all data from storage
   */
  clear(): Promise<void>;
}
