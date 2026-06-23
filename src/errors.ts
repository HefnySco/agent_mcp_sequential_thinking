/**
 * Base error class for Sequential MCP errors
 */
export class SequentialError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SequentialError';
    Object.setPrototypeOf(this, SequentialError.prototype);
  }
}

/**
 * Error thrown when a task is not found
 */
export class TaskNotFoundError extends SequentialError {
  constructor(taskId: string) {
    super(`Task with ID '${taskId}' not found`, 'TASK_NOT_FOUND');
    this.name = 'TaskNotFoundError';
    Object.setPrototypeOf(this, TaskNotFoundError.prototype);
  }
}

/**
 * Error thrown when a workflow is not found
 */
export class WorkflowNotFoundError extends SequentialError {
  constructor(workflowId: string) {
    super(`Workflow with ID '${workflowId}' not found`, 'WORKFLOW_NOT_FOUND');
    this.name = 'WorkflowNotFoundError';
    Object.setPrototypeOf(this, WorkflowNotFoundError.prototype);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends SequentialError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when a task cannot be executed due to dependencies
 */
export class TaskExecutionError extends SequentialError {
  constructor(taskId: string, reason: string) {
    super(`Task '${taskId}' cannot be executed: ${reason}`, 'TASK_EXECUTION_ERROR');
    this.name = 'TaskExecutionError';
    Object.setPrototypeOf(this, TaskExecutionError.prototype);
  }
}

/**
 * Error thrown when a dependency is not found
 */
export class DependencyNotFoundError extends SequentialError {
  constructor(dependencyId: string) {
    super(`Dependency '${dependencyId}' not found`, 'DEPENDENCY_NOT_FOUND');
    this.name = 'DependencyNotFoundError';
    Object.setPrototypeOf(this, DependencyNotFoundError.prototype);
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends SequentialError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'STORAGE_ERROR');
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends SequentialError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
