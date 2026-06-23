import { SequentialService } from './sequentialService.js';
import { getLogger } from './logger.js';
import { 
  ValidationError, 
  TaskNotFoundError, 
  WorkflowNotFoundError,
  TaskExecutionError
} from './errors.js';
import { 
  CreateTaskSchema, 
  UpdateTaskSchema, 
  TaskIdSchema,
  CreateWorkflowSchema,
  ExecuteTaskSchema,
  FailTaskSchema,
  MarkInProgressSchema,
  ResetTaskSchema,
  RetryTaskSchema,
  CanExecuteSchema,
  WorkflowIdSchema,
  StartWorkflowExecutionSchema,
  AdvanceWorkflowRunSchema,
  GetWorkflowRunSchema,
  GetNextWorkflowTasksSchema
} from './validation.js';
import { ERROR_MESSAGES } from './constants.js';

/**
 * Tool handler context
 */
interface HandlerContext {
  service: SequentialService;
  logger: ReturnType<typeof getLogger>;
}

/**
 * Create task handler
 */
export async function handleCreateTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = CreateTaskSchema.parse(args);

  const task = service.createTask({
    name: validated.name,
    description: validated.description,
    dependencies: validated.dependencies,
    metadata: validated.metadata,
    maxRetries: validated.maxRetries
  });

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task created successfully',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('create_task', args, result);
  return result;
}

/**
 * Update task handler
 */
export async function handleUpdateTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = UpdateTaskSchema.parse(args);

  const updates: Record<string, unknown> = {};
  if (validated.name !== undefined) updates.name = validated.name;
  if (validated.description !== undefined) updates.description = validated.description;
  if (validated.dependencies !== undefined) updates.dependencies = validated.dependencies;
  if (validated.metadata !== undefined) updates.metadata = validated.metadata;

  const task = service.updateTask(validated.id, updates);
  
  if (!task) {
    throw new TaskNotFoundError(validated.id);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task updated successfully',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('update_task', args, result);
  return result;
}

/**
 * Delete task handler
 */
export async function handleDeleteTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = TaskIdSchema.parse(args);

  const deleted = service.deleteTask(validated);
  
  if (!deleted) {
    throw new TaskNotFoundError(validated);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task deleted successfully',
          id: validated
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('delete_task', args, result);
  return result;
}

/**
 * Get task handler
 */
export async function handleGetTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = TaskIdSchema.parse(args);

  const task = service.getTask(validated);
  
  if (!task) {
    throw new TaskNotFoundError(validated);
  }

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_task', args, result);
  return result;
}

/**
 * List tasks handler
 */
export async function handleListTasks(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  const status = args?.status as string | undefined;
  
  let tasks;
  if (status) {
    tasks = service.getTasksByStatus(status as any);
  } else {
    tasks = service.getAllTasks();
  }

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tasks,
          count: tasks.length,
          filter: status || 'all'
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('list_tasks', args, result);
  return result;
}

/**
 * Execute task handler
 */
export async function handleExecuteTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = ExecuteTaskSchema.parse(args);

  const task = service.executeTask(validated.id, validated.result);
  
  if (!task) {
    throw new TaskExecutionError(validated.id, ERROR_MESSAGES.DEPENDENCY_NOT_MET);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task executed successfully',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('execute_task', args, result);
  return result;
}

/**
 * Fail task handler
 */
export async function handleFailTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = FailTaskSchema.parse(args);

  const task = service.failTask(validated.id, validated.error);
  
  if (!task) {
    throw new TaskNotFoundError(validated.id);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task marked as failed',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('fail_task', args, result);
  return result;
}

/**
 * Mark task in progress handler
 */
export async function handleMarkInProgress(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = MarkInProgressSchema.parse(args);

  const task = service.markTaskInProgress(validated.id);
  
  if (!task) {
    throw new TaskExecutionError(validated.id, ERROR_MESSAGES.DEPENDENCY_NOT_MET);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task marked as in progress',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('mark_in_progress', args, result);
  return result;
}

/**
 * Reset task handler
 */
export async function handleResetTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = ResetTaskSchema.parse(args);

  const task = service.resetTask(validated.id);
  
  if (!task) {
    throw new TaskNotFoundError(validated.id);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task reset successfully',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('reset_task', args, result);
  return result;
}

/**
 * Retry task handler
 */
export async function handleRetryTask(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = RetryTaskSchema.parse(args);

  const task = service.retryTask(validated.id);
  
  if (!task) {
    throw new TaskNotFoundError(validated.id);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Task retried successfully',
          task
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('retry_task', args, result);
  return result;
}

/**
 * Get next tasks handler
 */
export async function handleGetNextTasks(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  const tasks = service.getNextExecutableTasks();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tasks,
          count: tasks.length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_next_tasks', args, result);
  return result;
}

/**
 * Can execute handler
 */
export async function handleCanExecute(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = CanExecuteSchema.parse(args);

  const check = service.canExecuteTask(validated.id);

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          taskId: validated.id,
          ...check
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('can_execute', args, result);
  return result;
}

/**
 * Create workflow handler
 */
export async function handleCreateWorkflow(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = CreateWorkflowSchema.parse(args);

  const workflowId = service.createWorkflow(validated.name, validated.taskIds);
  
  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Workflow created successfully',
          workflowId,
          name: validated.name,
          taskIds: validated.taskIds
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('create_workflow', args, result);
  return result;
}

/**
 * Get workflow handler
 */
export async function handleGetWorkflow(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = WorkflowIdSchema.parse(args);

  const taskIds = service.getWorkflow(validated);
  
  if (!taskIds) {
    throw new WorkflowNotFoundError(validated);
  }

  const tasks = taskIds.map(taskId => service.getTask(taskId)).filter(Boolean);

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          workflowId: validated,
          taskIds,
          tasks
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_workflow', args, result);
  return result;
}

/**
 * List workflows handler
 */
export async function handleListWorkflows(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  const workflows = service.getAllWorkflows();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          workflows,
          count: Object.keys(workflows).length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('list_workflows', args, result);
  return result;
}

/**
 * Delete workflow handler
 */
export async function handleDeleteWorkflow(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = WorkflowIdSchema.parse(args);

  const deleted = service.deleteWorkflow(validated);
  
  if (!deleted) {
    throw new WorkflowNotFoundError(validated);
  }

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Workflow deleted successfully',
          workflowId: validated
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('delete_workflow', args, result);
  return result;
}

/**
 * Get stats handler
 */
export async function handleGetStats(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  const stats = service.getStats();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          stats
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_stats', args, result);
  return result;
}

/**
 * Clear all handler
 */
export async function handleClearAll(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  service.clearAll();
  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'All tasks and workflows cleared'
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('clear_all', args, result);
  return result;
}

/**
 * Save state handler
 */
export async function handleSaveState(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  await service.save();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'State saved successfully'
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('save_state', args, result);
  return result;
}

/**
 * Get version handler
 */
export async function handleGetVersion(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { logger } = context;

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          name: 'sequential',
          version: '1.0.0',
          description: 'Sequential task execution MCP server with dependency management and workflow support',
          features: ['task_management', 'dependency_tracking', 'workflow_support', 'persistent_storage', 'execution_tracking', 'retry_logic', 'workflow_execution']
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_version', args, result);
  return result;
}

/**
 * Start workflow execution handler
 */
export async function handleStartWorkflowExecution(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = StartWorkflowExecutionSchema.parse(args);

  const result = service.startWorkflowExecution(validated.workflowId);
  
  if (!result) {
    throw new WorkflowNotFoundError(validated.workflowId);
  }

  await service.save();

  const response = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Workflow execution started',
          runId: result.runId,
          workflowId: validated.workflowId,
          readyTasks: result.readyTasks,
          readyTaskCount: result.readyTasks.length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('start_workflow_execution', args, response);
  return response;
}

/**
 * Advance workflow run handler
 */
export async function handleAdvanceWorkflowRun(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = AdvanceWorkflowRunSchema.parse(args);

  const result = service.advanceWorkflowRun(validated.runId);
  
  if (!result) {
    throw new WorkflowNotFoundError(validated.runId);
  }

  await service.save();

  const response = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: 'Workflow run advanced',
          run: result.run,
          newReadyTasks: result.newReadyTasks,
          newReadyTaskCount: result.newReadyTasks.length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('advance_workflow_run', args, response);
  return response;
}

/**
 * Get workflow run handler
 */
export async function handleGetWorkflowRun(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = GetWorkflowRunSchema.parse(args);

  const run = service.getWorkflowRun(validated.runId);
  
  if (!run) {
    throw new WorkflowNotFoundError(validated.runId);
  }

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          run
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_workflow_run', args, result);
  return result;
}

/**
 * List workflow runs handler
 */
export async function handleListWorkflowRuns(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  const runs = service.getAllWorkflowRuns();

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          runs,
          count: runs.length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('list_workflow_runs', args, result);
  return result;
}

/**
 * Get next workflow tasks handler
 */
export async function handleGetNextWorkflowTasks(
  context: HandlerContext,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { service, logger } = context;

  // Validate input
  const validated = GetNextWorkflowTasksSchema.parse(args);

  const tasks = service.getNextWorkflowTasks(validated.workflowId);

  const result = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          workflowId: validated.workflowId,
          tasks,
          count: tasks.length
        }, null, 2)
      }
    ]
  };

  await logger.logToolRequest('get_next_workflow_tasks', args, result);
  return result;
}

/**
 * Handler registry mapping tool names to their handlers
 */
export const handlerRegistry: Record<string, (context: HandlerContext, args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>> = {
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  delete_task: handleDeleteTask,
  get_task: handleGetTask,
  list_tasks: handleListTasks,
  execute_task: handleExecuteTask,
  fail_task: handleFailTask,
  mark_in_progress: handleMarkInProgress,
  reset_task: handleResetTask,
  retry_task: handleRetryTask,
  get_next_tasks: handleGetNextTasks,
  can_execute: handleCanExecute,
  create_workflow: handleCreateWorkflow,
  get_workflow: handleGetWorkflow,
  list_workflows: handleListWorkflows,
  delete_workflow: handleDeleteWorkflow,
  start_workflow_execution: handleStartWorkflowExecution,
  advance_workflow_run: handleAdvanceWorkflowRun,
  get_workflow_run: handleGetWorkflowRun,
  list_workflow_runs: handleListWorkflowRuns,
  get_next_workflow_tasks: handleGetNextWorkflowTasks,
  get_stats: handleGetStats,
  clear_all: handleClearAll,
  save_state: handleSaveState,
  get_version: handleGetVersion
};
