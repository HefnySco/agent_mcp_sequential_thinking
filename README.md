# ⚡ Sequential MCP Server

**Sequential MCP** is a task orchestration server that helps AI agents execute complex workflows with proper dependency management. Think of it as a smart task scheduler—define your tasks, set up dependencies between them, and let the system handle execution order, retries, and progress tracking. Perfect for CI/CD pipelines, multi-step processes, and any workflow that needs tasks to run in the right sequence.

Whether you're building deployment pipelines, running test suites, or coordinating multi-stage processes, Sequential MCP provides structured task execution with automatic dependency resolution, retry logic, and persistent storage for tracking progress over time.

## ✨ Features

- **📋 Task Management** - Create, update, delete, and track tasks with different statuses (pending, in_progress, completed, failed)
- **🔗 Dependency Tracking** - Define task dependencies to ensure tasks execute in the correct order
- **🔄 Workflow Support** - Group tasks into workflows for organized execution
- **🚀 Workflow Execution** - Orchestrate workflow runs with automatic task progression
- **⏱️ Execution Time Tracking** - Track task start and completion times with duration calculation
- **🔁 Retry Logic** - Configure automatic retry limits for failed tasks
- **💾 Persistent Storage** - All tasks and workflows are saved to JSON file storage
- **📊 Execution Tracking** - Track task execution results and errors
- **📝 Activity Logging** - All tool calls are logged to the output directory for debugging and auditing

## 🚀 Installation

```bash
npm install
npm run build
```

## ⚙️ Configuration

The MCP server is configured via environment variables in `mcp.json`:

```json
{
  "mcpServers": {
    "sequential": {
      "command": "node",
      "args": ["/home/mhefny/code/mcp/sequential-mcp/dist/index.js"],
      "env": {
        "SEQUENTIAL_STORAGE_PATH": "/home/mhefny/code/mcp/sequential-mcp/sequential-storage.json",
        "SEQUENTIAL_OUTPUT_DIR": "/home/mhefny/code/mcp/sequential-mcp/output"
      }
    }
  }
}
```

- `SEQUENTIAL_STORAGE_PATH`: Path to the JSON file where tasks and workflows are stored
- `SEQUENTIAL_OUTPUT_DIR`: Directory where activity logs are stored

## 🎯 Quick Start

### Basic Example

Create a task:
```json
{
  "name": "Build frontend",
  "description": "Build the React frontend application",
  "dependencies": ["task_123"],
  "metadata": {
    "priority": "high",
    "estimated_time": "5m"
  },
  "maxRetries": 3
}
```

Create a workflow:
```json
{
  "name": "CI Pipeline",
  "taskIds": ["task_1_id", "task_2_id", "task_3_id"]
}
```

Start workflow execution:
```json
{
  "workflowId": "workflow_abc123"
}
```

## 🛠️ Available Tools

### Task Management

### `create_task`
Create a new task with optional dependencies.

**Parameters:**
- `name` (required): The name of the task
- `description` (optional): Description of the task
- `dependencies` (optional): Array of task IDs that this task depends on
- `metadata` (optional): Additional metadata for the task
- `maxRetries` (optional): Maximum number of retry attempts for this task

### `update_task`
Update an existing task.

**Parameters:**
- `id` (required): The ID of the task to update
- `name` (optional): New name for the task
- `description` (optional): New description
- `dependencies` (optional): New dependencies
- `metadata` (optional): New metadata

### `delete_task`
Delete a task by ID.

**Parameters:**
- `id` (required): The ID of the task to delete

### `get_task`
Get a specific task by ID.

**Parameters:**
- `id` (required): The ID of the task to retrieve

### `list_tasks`
List all tasks or filter by status.

**Parameters:**
- `status` (optional): Filter by status ('pending', 'in_progress', 'completed', 'failed')

### Task Execution

### `execute_task`
Mark a task as completed with a result.

**Parameters:**
- `id` (required): The ID of the task to execute
- `result` (optional): The result of the task execution

### `fail_task`
Mark a task as failed with an error message.

**Parameters:**
- `id` (required): The ID of the task to fail
- `error` (required): The error message

### `mark_in_progress`
Mark a task as in progress.

**Parameters:**
- `id` (required): The ID of the task to mark as in progress

### `reset_task`
Reset a task back to pending status.

**Parameters:**
- `id` (required): The ID of the task to reset

### `retry_task`
Retry a failed task, incrementing retry count.

**Parameters:**
- `id` (required): The ID of the task to retry

**Note:** Task will only be retried if it hasn't exceeded its `maxRetries` limit.

### Dependency Management

### `get_next_tasks`
Get tasks that are ready to execute (all dependencies completed).

### `can_execute`
Check if a task can be executed based on its dependencies.

**Parameters:**
- `id` (required): The ID of the task to check

### Workflow Management

### `create_workflow`
Create a workflow (group of tasks in sequence).

**Parameters:**
- `name` (required): The name of the workflow
- `taskIds` (required): Array of task IDs in the workflow

### `get_workflow`
Get a workflow by ID.

**Parameters:**
- `id` (required): The ID of the workflow to retrieve

### `list_workflows`
List all workflows.

### `delete_workflow`
Delete a workflow by ID.

**Parameters:**
- `id` (required): The ID of the workflow to delete

### Workflow Execution

### `start_workflow_execution`
Start execution of a workflow, creating a workflow run.

**Parameters:**
- `workflowId` (required): The ID of the workflow to execute

### `advance_workflow_run`
Advance a workflow run to the next task.

**Parameters:**
- `runId` (required): The ID of the workflow run to advance

### `get_workflow_run`
Get a workflow run by ID.

**Parameters:**
- `runId` (required): The ID of the workflow run to retrieve

### `list_workflow_runs`
List all workflow runs.

### `get_next_workflow_tasks`
Get tasks that are ready to execute within a specific workflow (dependency-aware).

**Parameters:**
- `workflowId` (required): The ID of the workflow to get ready tasks for

### System

### `get_stats`
Get statistics about tasks and workflows.

### `clear_all`
Clear all tasks and workflows.

### `save_state`
Manually save the current state to storage.

### `get_version`
Get the version information of this sequential MCP server.

## 📖 Usage Example

### Creating a Sequential Task Chain

1. **Create initial tasks with no dependencies:**
```json
{
  "name": "Install dependencies"
}
```

2. **Create dependent tasks:**
```json
{
  "name": "Run tests",
  "dependencies": ["task_1234567890_abc"]
}
```

3. **Check which tasks can be executed:** (Use `get_next_tasks` tool)

4. **Execute a task:**
```json
{
  "id": "task_1234567890_abc",
  "result": {
    "status": "success",
    "duration": "30s"
  }
}
```

5. **Check if dependent task can now be executed:** (Use `can_execute` tool)

### Creating a Workflow

1. **Create multiple tasks** with dependencies as needed

2. **Create a workflow:**
```json
{
  "name": "CI Pipeline",
  "taskIds": ["task_1_id", "task_2_id", "task_3_id"]
}
```

### Dependency-Aware Workflow Orchestration

The sequential-mcp supports true dependency-aware workflow execution that respects the full task dependency graph (not just linear execution). This enables parallel execution of independent tasks within a workflow.

#### Key Benefits

- **🚀 Parallel Execution** - Independent tasks can run simultaneously (e.g., frontend and backend builds)
- **🔗 Dependency Graph** - Full DAG support, not just linear sequences
- **⏭️ Automatic Progression** - System automatically finds newly unlocked tasks after dependencies complete
- **📊 State Tracking** - Workflow runs track completed, active, and blocked tasks
- **🛡️ Error Handling** - Failed tasks with retry limits are handled gracefully
- **🤖 Agent-Friendly** - Clear responses showing exactly what tasks to work on next
- **✅ Backward Compatible** - Existing linear workflows continue to work seamlessly

## 📝 Logging

All tool calls are automatically logged to the output directory specified by `SEQUENTIAL_OUTPUT_DIR`. Logs are organized by date:

```
output/
├── sequential-log-2024-06-22.json
├── sequential-log-2024-06-23.json
└── ...
```

Each log entry contains:
- `timestamp`: When the tool was called
- `tool`: Name of the tool
- `arguments`: Arguments passed to the tool
- `result`: Result returned by the tool

## 🛠️ Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Start server
npm start
```

## 💾 Storage

Tasks and workflows are stored in a JSON file at the path specified by `SEQUENTIAL_STORAGE_PATH`. The file contains:

```json
{
  "tasks": {
    "task_id": {
      "id": "task_id",
      "name": "Task name",
      "description": "Task description",
      "status": "pending",
      "dependencies": [],
      "createdAt": "2024-06-22T10:00:00.000Z",
      "updatedAt": "2024-06-22T10:00:00.000Z",
      "result": null,
      "error": null,
      "metadata": {}
    }
  },
  "workflows": {
    "workflow_id": ["task_id_1", "task_id_2"]
  }
}
```

## 📄 License

MIT
