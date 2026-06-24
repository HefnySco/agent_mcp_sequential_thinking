# Storage Backend Configuration

The Task Orchestrator MCP server supports multiple storage backends through an abstract adapter pattern.

## Supported Storage Backends

### JSON (Default)
- Stores data as a JSON file
- Simple and human-readable
- No additional dependencies
- Default file: `task-orchestrator-storage.json`

### SQLite
- Stores data in a SQLite database using sql.js (pure JavaScript)
- Better performance for large datasets
- Supports SQL queries
- Default file: `task-orchestrator-storage.db`

## Configuration

### Environment Variables

- `TASK_ORCHESTRATOR_STORAGE_BACKEND`: Storage backend type (`json` or `sqlite`, default: `json`)
- `TASK_ORCHESTRATOR_STORAGE_PATH`: Path to storage file/database (default depends on backend)

### Examples

#### Use JSON storage (default)
```bash
export TASK_ORCHESTRATOR_STORAGE_BACKEND=json
export TASK_ORCHESTRATOR_STORAGE_PATH=./my-storage.json
```

#### Use SQLite storage
```bash
export TASK_ORCHESTRATOR_STORAGE_BACKEND=sqlite
export TASK_ORCHESTRATOR_STORAGE_PATH=./my-storage.db
```

## Architecture

The storage layer uses an abstract adapter pattern:

```
IStorageAdapter (interface)
├── JsonStorageAdapter
└── SqliteStorageAdapter
```

### StorageFactory
The `StorageFactory` creates the appropriate adapter based on configuration:

```typescript
const storageAdapter = StorageFactory.createAdapter(
  config.getStorageBackend(),
  config.getStoragePath()
);
```

### Adding New Storage Backends

To add a new storage backend:

1. Create a new class implementing `IStorageAdapter`
2. Add the backend type to the `StorageBackend` type in `types.ts`
3. Add a case in `StorageFactory.createAdapter()`
4. Update configuration to support the new backend

## Implementation Details

### IStorageAdapter Interface

```typescript
interface IStorageAdapter {
  load(): Promise<SequentialState>;
  save(state: SequentialState): Promise<void>;
  initialize(): Promise<void>;
  close(): Promise<void>;
  clear(): Promise<void>;
}
```

### Data Schema

#### Tasks Table (SQLite)
- `id`: TEXT PRIMARY KEY
- `name`: TEXT NOT NULL
- `description`: TEXT
- `status`: TEXT NOT NULL
- `dependencies`: TEXT (JSON array)
- `parent_task_id`: TEXT
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL
- `started_at`: TEXT
- `completed_at`: TEXT
- `retries`: INTEGER DEFAULT 0
- `max_retries`: INTEGER
- `timeout_ms`: INTEGER
- `result`: TEXT (JSON)
- `error`: TEXT
- `metadata`: TEXT (JSON)

#### Workflows Table (SQLite)
- `id`: TEXT PRIMARY KEY
- `name`: TEXT NOT NULL
- `task_ids`: TEXT NOT NULL (JSON array)
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL

#### Workflow Runs Table (SQLite)
- `id`: TEXT PRIMARY KEY
- `workflow_id`: TEXT NOT NULL
- `status`: TEXT NOT NULL
- `completed_task_ids`: TEXT (JSON array)
- `active_task_ids`: TEXT (JSON array)
- `blocked_task_ids`: TEXT (JSON array)
- `started_at`: TEXT
- `completed_at`: TEXT
- `error`: TEXT
- `continue_on_failure`: INTEGER DEFAULT 0

## Migration

Data is automatically migrated when switching between backends:

- JSON → SQLite: Load from JSON, save to SQLite
- SQLite → JSON: Load from SQLite, save to JSON

Simply change the `TASK_ORCHESTRATOR_STORAGE_BACKEND` environment variable and restart the server.
