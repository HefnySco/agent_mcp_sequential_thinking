# Sequential MCP Server

A Model Context Protocol (MCP) server for sequential task execution with dependency management and workflow support.

## Features

- **Task Management**: Create, update, delete, and track tasks with different statuses (pending, in_progress, completed, failed)
- **Dependency Tracking**: Define task dependencies to ensure tasks execute in the correct order
- **Workflow Support**: Group tasks into workflows for organized execution
- **Workflow Execution**: Orchestrate workflow runs with automatic task progression
- **Execution Time Tracking**: Track task start and completion times with duration calculation
- **Retry Logic**: Configure automatic retry limits for failed tasks
- **Persistent Storage**: All tasks and workflows are saved to JSON file storage
- **Execution Tracking**: Track task execution results and errors
- **Activity Logging**: All tool calls are logged to the output directory for debugging and auditing

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Configuration

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

## Available Tools

### Task Management

#### `create_task`
Create a new task with optional dependencies.

**Parameters:**
- `name` (required): The name of the task
- `description` (optional): Description of the task
- `dependencies` (optional): Array of task IDs that this task depends on
- `metadata` (optional): Additional metadata for the task
- `maxRetries` (optional): Maximum number of retry attempts for this task

**Example:**
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

#### `update_task`
Update an existing task.

**Parameters:**
- `id` (required): The ID of the task to update
- `name` (optional): New name for the task
- `description` (optional): New description
- `dependencies` (optional): New dependencies
- `metadata` (optional): New metadata

#### `delete_task`
Delete a task by ID.

**Parameters:**
- `id` (required): The ID of the task to delete

#### `get_task`
Get a specific task by ID.

**Parameters:**
- `id` (required): The ID of the task to retrieve

#### `list_tasks`
List all tasks or filter by status.

**Parameters:**
- `status` (optional): Filter by status ('pending', 'in_progress', 'completed', 'failed')

### Task Execution

#### `execute_task`
Mark a task as completed with a result.

**Parameters:**
- `id` (required): The ID of the task to execute
- `result` (optional): The result of the task execution

#### `fail_task`
Mark a task as failed with an error message.

**Parameters:**
- `id` (required): The ID of the task to fail
- `error` (required): The error message

#### `mark_in_progress`
Mark a task as in progress.

**Parameters:**
- `id` (required): The ID of the task to mark as in progress

#### `reset_task`
Reset a task back to pending status.

**Parameters:**
- `id` (required): The ID of the task to reset

#### `retry_task`
Retry a failed task, incrementing retry count.

**Parameters:**
- `id` (required): The ID of the task to retry

**Note:** Task will only be retried if it hasn't exceeded its `maxRetries` limit.

### Dependency Management

#### `get_next_tasks`
Get tasks that are ready to execute (all dependencies completed).

#### `can_execute`
Check if a task can be executed based on its dependencies.

**Parameters:**
- `id` (required): The ID of the task to check

### Workflow Management

#### `create_workflow`
Create a workflow (group of tasks in sequence).

**Parameters:**
- `name` (required): The name of the workflow
- `taskIds` (required): Array of task IDs in the workflow

#### `get_workflow`
Get a workflow by ID.

**Parameters:**
- `id` (required): The ID of the workflow to retrieve

#### `list_workflows`
List all workflows.

#### `delete_workflow`
Delete a workflow by ID.

**Parameters:**
- `id` (required): The ID of the workflow to delete

### Workflow Execution

#### `start_workflow_execution`
Start execution of a workflow, creating a workflow run.

**Parameters:**
- `workflowId` (required): The ID of the workflow to execute

**Example:**
```json
{
  "workflowId": "workflow_abc123"
}
```

#### `advance_workflow_run`
Advance a workflow run to the next task.

**Parameters:**
- `runId` (required): The ID of the workflow run to advance

**Example:**
```json
{
  "runId": "run_xyz789"
}
```

#### `get_workflow_run`
Get a workflow run by ID.

**Parameters:**
- `runId` (required): The ID of the workflow run to retrieve

#### `list_workflow_runs`
List all workflow runs.

#### `get_next_workflow_tasks`
Get tasks that are ready to execute within a specific workflow (dependency-aware).

**Parameters:**
- `workflowId` (required): The ID of the workflow to get ready tasks for

**Example:**
```json
{
  "workflowId": "workflow_abc123"
}
```

### System

#### `get_stats`
Get statistics about tasks and workflows.

#### `clear_all`
Clear all tasks and workflows.

#### `save_state`
Manually save the current state to storage.

#### `get_version`
Get the version information of this sequential MCP server.

## Usage Example

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

3. **Check which tasks can be executed:**
```json
{}
```
(Use `get_next_tasks` tool)

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

5. **Check if dependent task can now be executed:**
```json
{
  "id": "task_9876543210_xyz"
}
```
(Use `can_execute` tool)

### Creating a Workflow

1. **Create multiple tasks:**
```json
{
  "name": "Task 1"
}
```
```json
{
  "name": "Task 2",
  "dependencies": ["task_1_id"]
}
```
```json
{
  "name": "Task 3",
  "dependencies": ["task_2_id"]
}
```

2. **Create a workflow:**
```json
{
  "name": "CI Pipeline",
  "taskIds": ["task_1_id", "task_2_id", "task_3_id"]
}
```

### Dependency-Aware Workflow Orchestration

The sequential-mcp now supports true dependency-aware workflow execution that respects the full task dependency graph (not just linear execution). This enables parallel execution of independent tasks within a workflow.

#### Example 1: DAG-based Workflow with Fan-Out/Fan-In Pattern

**Scenario:** A CI/CD pipeline where frontend and backend build in parallel after dependencies install, then tests run after both complete.

1. **Create tasks with complex dependencies:**
```json
{
  "name": "Install dependencies",
  "maxRetries": 2
}
```
```json
{
  "name": "Build frontend",
  "dependencies": ["install_deps_id"]
}
```
```json
{
  "name": "Build backend",
  "dependencies": ["install_deps_id"]
}
```
```json
{
  "name": "Run tests",
  "dependencies": ["build_frontend_id", "build_backend_id"]
}
```

2. **Create a workflow:**
```json
{
  "name": "Full Build Pipeline",
  "taskIds": ["install_deps_id", "build_frontend_id", "build_backend_id", "run_tests_id"]
}
```

3. **Start workflow execution:**
```json
{
  "workflowId": "workflow_abc123"
}
```
**Response:**
```json
{
  "message": "Workflow execution started",
  "runId": "run_xyz789",
  "workflowId": "workflow_abc123",
  "readyTasks": [
    {
      "id": "install_deps_id",
      "name": "Install dependencies",
      "status": "in_progress"
    }
  ],
  "readyTaskCount": 1
}
```

4. **Execute the ready task:**
```json
{
  "id": "install_deps_id",
  "result": { "status": "success" }
}
```

5. **Advance the workflow run:**
```json
{
  "runId": "run_xyz789"
}
```
**Response:**
```json
{
  "message": "Workflow run advanced",
  "run": {
    "id": "run_xyz789",
    "status": "in_progress",
    "completedTaskIds": ["install_deps_id"],
    "activeTaskIds": ["build_frontend_id", "build_backend_id"],
    "blockedTaskIds": ["run_tests_id"]
  },
  "newReadyTasks": [
    { "id": "build_frontend_id", "name": "Build frontend" },
    { "id": "build_backend_id", "name": "Build backend" }
  ],
  "newReadyTaskCount": 2
}
```

6. **Execute multiple tasks in parallel:**
```json
{
  "id": "build_frontend_id",
  "result": { "status": "success" }
}
```
```json
{
  "id": "build_backend_id",
  "result": { "status": "success" }
}
```

7. **Advance again to unlock final task:**
```json
{
  "runId": "run_xyz789"
}
```
**Response:** "Run tests" is now ready since both dependencies are completed.

#### Example 2: Error Handling and Retry within Workflows

**Scenario:** A task fails but has retry limits configured.

1. **Create a task with retry limits:**
```json
{
  "name": "Flaky integration test",
  "maxRetries": 3
}
```

2. **Start workflow execution** (task becomes active)

3. **Task fails:**
```json
{
  "id": "flaky_test_id",
  "error": "Test timeout after 30s"
}
```

4. **Retry the failed task:**
```json
{
  "id": "flaky_test_id"
}
```
**Response:** Task is reset to pending with incremented retry count.

5. **Advance workflow run:**
```json
{
  "runId": "run_xyz789"
}
```
**Response:** Task is marked as active again (retry count was within limits).

6. **If retry limit exceeded:** The workflow run will be marked as failed with an error message.

#### Example 3: Inspecting Workflow Run State

**Check the current state of a workflow run:**
```json
{
  "runId": "run_xyz789"
}
```
**Response:**
```json
{
  "run": {
    "id": "run_xyz789",
    "workflowId": "workflow_abc123",
    "status": "in_progress",
    "completedTaskIds": ["task_1", "task_2"],
    "activeTaskIds": ["task_3", "task_4"],
    "blockedTaskIds": ["task_5"],
    "startedAt": "2024-06-23T10:00:00.000Z"
  }
}
```

**List all workflow runs:**
```json
{}
```
**Response:** Returns all workflow runs with their current states.

#### Example 4: Querying Ready Tasks for a Workflow

**Check what tasks are ready to execute in a specific workflow:**
```json
{
  "workflowId": "workflow_abc123"
}
```
**Response:**
```json
{
  "workflowId": "workflow_abc123",
  "tasks": [
    { "id": "task_3", "name": "Build frontend" },
    { "id": "task_4", "name": "Build backend" }
  ],
  "count": 2
}
```

This is useful for checking what can be worked on next without starting a new workflow run.

#### Key Benefits

- **Parallel Execution**: Independent tasks can run simultaneously (e.g., frontend and backend builds)
- **Dependency Graph**: Full DAG support, not just linear sequences
- **Automatic Progression**: System automatically finds newly unlocked tasks after dependencies complete
- **State Tracking**: Workflow runs track completed, active, and blocked tasks
- **Error Handling**: Failed tasks with retry limits are handled gracefully
- **Agent-Friendly**: Clear responses showing exactly what tasks to work on next
- **Backward Compatible**: Existing linear workflows continue to work seamlessly

## Logging

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

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run dev
```

### Start server
```bash
npm start
```

## Storage

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

## License

MIT
