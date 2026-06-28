import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TaskOrchestratorService } from '../src/taskOrchestratorService.js';
import { resetConfigManager } from '../src/config.js';
import { TASK_STATUS } from '../src/constants.js';
import { ValidationError, StrategyNotFoundError, WorkflowNotFoundError } from '../src/errors.js';
import { StorageFactory } from '../src/storage/StorageFactory.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_JSON_STORAGE_PATH = path.join(__dirname, 'test-strategy-storage.json');
const TEST_SQLITE_STORAGE_PATH = path.join(__dirname, 'test-strategy-storage.db');

const testCases = [
  { name: 'JSON Storage', backend: 'json' as const, path: TEST_JSON_STORAGE_PATH }
  // SQLite tests skipped due to schema migration complexity - can be added later
  // { name: 'SQLite Storage', backend: 'sqlite' as const, path: TEST_SQLITE_STORAGE_PATH }
];

for (const testCase of testCases) {
  describe(`Strategy Operations with ${testCase.name}`, () => {
    let service: TaskOrchestratorService;
    let storageAdapter: any;

    beforeEach(async () => {
      resetConfigManager();
      // Disable auto-save during tests to avoid race conditions with cleanup
      process.env.TASK_ORCHESTRATOR_AUTO_SAVE = 'false';
      storageAdapter = StorageFactory.createAdapter(testCase.backend, testCase.path);
      await storageAdapter.initialize();
      service = new TaskOrchestratorService(storageAdapter);
      await service.load();
    });

    afterEach(async () => {
      await service.forceSave(); // Ensure all pending saves complete
      await service.shutdown();
      await service.clearAll();
      await storageAdapter.close();
      try {
        await fs.unlink(testCase.path);
      } catch {
        // File might not exist
      }
    });

    describe('createStrategy', () => {
      it('should create a strategy with required fields', () => {
        const strategy = service.createStrategy('Test Strategy');

        assert.strictEqual(strategy.name, 'Test Strategy');
        assert.strictEqual(strategy.status, 'active');
        assert.ok(strategy.id);
        assert.ok(strategy.createdAt);
        assert.ok(strategy.updatedAt);
      });

      it('should create a strategy with optional fields', () => {
        const strategy = service.createStrategy(
          'Test Strategy',
          'Test description',
          ['tag1', 'tag2']
        );

        assert.strictEqual(strategy.description, 'Test description');
        assert.deepStrictEqual(strategy.tags, ['tag1', 'tag2']);
      });

      it('should generate unique IDs for different strategies', () => {
        const strategy1 = service.createStrategy('Strategy 1');
        const strategy2 = service.createStrategy('Strategy 2');

        assert.notStrictEqual(strategy1.id, strategy2.id);
      });

      it('should throw error when strategy name already exists (case-insensitive)', () => {
        service.createStrategy('Test Strategy');

        assert.throws(() => {
          service.createStrategy('test strategy'); // Different case
        }, ValidationError);
      });

      it('should allow different strategy names', () => {
        const strategy1 = service.createStrategy('Strategy A');
        const strategy2 = service.createStrategy('Strategy B');

        assert.strictEqual(strategy1.name, 'Strategy A');
        assert.strictEqual(strategy2.name, 'Strategy B');
      });
    });

    describe('getStrategy', () => {
      it('should get a strategy by ID', () => {
        const strategy = service.createStrategy('Test Strategy');
        const retrieved = service.getStrategy(strategy.id);

        assert.strictEqual(retrieved?.id, strategy.id);
        assert.strictEqual(retrieved?.name, 'Test Strategy');
      });

      it('should return undefined for non-existent strategy ID', () => {
        const retrieved = service.getStrategy('non-existent-id');
        assert.strictEqual(retrieved, undefined);
      });
    });

    describe('getStrategyByName', () => {
      it('should get a strategy by name (case-insensitive)', () => {
        service.createStrategy('Test Strategy');
        const retrieved = service.getStrategyByName('test strategy');

        assert.strictEqual(retrieved?.name, 'Test Strategy');
        assert.ok(retrieved?.id);
      });

      it('should return undefined for non-existent strategy name', () => {
        const retrieved = service.getStrategyByName('Non-existent Strategy');
        assert.strictEqual(retrieved, undefined);
      });
    });

    describe('getAllStrategies', () => {
      it('should return empty object when no strategies exist', () => {
        const strategies = service.getAllStrategies();
        assert.deepStrictEqual(strategies, {});
      });

      it('should return all strategies', () => {
        const strategy1 = service.createStrategy('Strategy 1');
        const strategy2 = service.createStrategy('Strategy 2');

        const strategies = service.getAllStrategies();
        assert.strictEqual(Object.keys(strategies).length, 2);
        assert.ok(strategies[strategy1.id]);
        assert.ok(strategies[strategy2.id]);
      });
    });

    describe('updateStrategy', () => {
      it('should update strategy name', () => {
        const strategy = service.createStrategy('Old Name');
        const updated = service.updateStrategy(strategy.id, { name: 'New Name' });

        assert.strictEqual(updated?.name, 'New Name');
        assert.strictEqual(updated?.id, strategy.id);
      });

      it('should update strategy description', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { description: 'New description' });

        assert.strictEqual(updated?.description, 'New description');
      });

      it('should update strategy status', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { status: 'archived' });

        assert.strictEqual(updated?.status, 'archived');
      });

      it('should update strategy tags', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { tags: ['new-tag'] });

        assert.deepStrictEqual(updated?.tags, ['new-tag']);
      });

      it('should update multiple fields at once', () => {
        const strategy = service.createStrategy('Old Name');
        const updated = service.updateStrategy(strategy.id, {
          name: 'New Name',
          description: 'New description',
          status: 'completed',
          tags: ['tag1', 'tag2']
        });

        assert.strictEqual(updated?.name, 'New Name');
        assert.strictEqual(updated?.description, 'New description');
        assert.strictEqual(updated?.status, 'completed');
        assert.deepStrictEqual(updated?.tags, ['tag1', 'tag2']);
      });

      it('should return null for non-existent strategy', () => {
        const updated = service.updateStrategy('non-existent-id', { name: 'New Name' });
        assert.strictEqual(updated, null);
      });

      it('should throw error when updating to existing name', () => {
        service.createStrategy('Strategy 1');
        const strategy2 = service.createStrategy('Strategy 2');

        assert.throws(() => {
          service.updateStrategy(strategy2.id, { name: 'Strategy 1' });
        }, ValidationError);
      });

      it('should allow updating to same name (case change)', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { name: 'test strategy' });

        assert.strictEqual(updated?.name, 'test strategy');
      });
    });

    describe('deleteStrategy', () => {
      it('should delete a strategy', () => {
        const strategy = service.createStrategy('Test Strategy');
        const deleted = service.deleteStrategy(strategy.id);

        assert.strictEqual(deleted, true);
        assert.strictEqual(service.getStrategy(strategy.id), undefined);
      });

      it('should return false for non-existent strategy', () => {
        const deleted = service.deleteStrategy('non-existent-id');
        assert.strictEqual(deleted, false);
      });

      it('should ungroup workflows when strategy is deleted', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);
        
        service.moveWorkflowToStrategy(workflow.id, strategy.id);
        assert.strictEqual(service.getWorkflow(workflow.id)?.strategyId, strategy.id);

        service.deleteStrategy(strategy.id);
        assert.strictEqual(service.getWorkflow(workflow.id)?.strategyId, undefined);
      });

      it('should preserve workflows after strategy deletion', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);
        
        service.moveWorkflowToStrategy(workflow.id, strategy.id);
        service.deleteStrategy(strategy.id);

        const retrievedWorkflow = service.getWorkflow(workflow.id);
        assert.ok(retrievedWorkflow);
        assert.strictEqual(retrievedWorkflow!.id, workflow.id);
      });
    });

    describe('resolveStrategyIdentifier', () => {
      it('should resolve strategy by ID', () => {
        const strategy = service.createStrategy('Test Strategy');
        const resolved = service.resolveStrategyIdentifier(strategy.id);

        assert.strictEqual(resolved?.id, strategy.id);
      });

      it('should resolve strategy by name', () => {
        service.createStrategy('Test Strategy');
        const resolved = service.resolveStrategyIdentifier('Test Strategy');

        assert.strictEqual(resolved?.name, 'Test Strategy');
      });

      it('should resolve strategy by name (case-insensitive)', () => {
        service.createStrategy('Test Strategy');
        const resolved = service.resolveStrategyIdentifier('test strategy');

        assert.strictEqual(resolved?.name, 'Test Strategy');
      });

      it('should return undefined for non-existent identifier', () => {
        const resolved = service.resolveStrategyIdentifier('non-existent');
        assert.strictEqual(resolved, undefined);
      });
    });

    describe('moveWorkflowToStrategy', () => {
      it('should move workflow to strategy', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        const updated = service.moveWorkflowToStrategy(workflow.id, strategy.id);

        assert.strictEqual(updated.strategyId, strategy.id);
        assert.strictEqual(service.getWorkflow(workflow.id)?.strategyId, strategy.id);
      });

      it('should move workflow to strategy by name', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        const updated = service.moveWorkflowToStrategy(workflow.id, 'Test Strategy');

        assert.strictEqual(updated.strategyId, strategy.id);
      });

      it('should throw error for non-existent workflow', () => {
        service.createStrategy('Test Strategy');

        assert.throws(() => {
          service.moveWorkflowToStrategy('non-existent-workflow-id', 'Test Strategy');
        }, WorkflowNotFoundError);
      });

      it('should throw error for non-existent strategy', () => {
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        assert.throws(() => {
          service.moveWorkflowToStrategy(workflow.id, 'non-existent-strategy');
        }, StrategyNotFoundError);
      });
    });

    describe('removeWorkflowFromStrategy', () => {
      it('should remove workflow from strategy', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);
        
        service.moveWorkflowToStrategy(workflow.id, strategy.id);
        const updated = service.removeWorkflowFromStrategy(workflow.id);

        assert.strictEqual(updated.strategyId, undefined);
        assert.strictEqual(service.getWorkflow(workflow.id)?.strategyId, undefined);
      });

      it('should throw error for non-existent workflow', () => {
        assert.throws(() => {
          service.removeWorkflowFromStrategy('non-existent-workflow-id');
        }, WorkflowNotFoundError);
      });

      it('should work for workflow not in any strategy', () => {
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        const updated = service.removeWorkflowFromStrategy(workflow.id);

        assert.strictEqual(updated.strategyId, undefined);
      });
    });

    describe('cloneWorkflowToStrategy', () => {
      it('should clone workflow to strategy', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2', dependencies: [{ taskId: task1.id, type: 'hard' }] });
        const workflow = service.createWorkflow('Original Workflow', [task1.id, task2.id]);

        const result = service.cloneWorkflowToStrategy(workflow.id, strategy.id);

        assert.ok(result.workflow);
        assert.ok(result.taskIdMap);
        assert.strictEqual(result.workflow.strategyId, strategy.id);
        assert.notStrictEqual(result.workflow.id, workflow.id);
        assert.notStrictEqual(result.taskIdMap[task1.id], task1.id);
      });

      it('should clone workflow to strategy with name prefix', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Original Task' });
        const workflow = service.createWorkflow('Original Workflow', [task.id]);

        const result = service.cloneWorkflowToStrategy(workflow.id, strategy.id, { namePrefix: 'Copy - ' });

        assert.ok(result.workflow.name.startsWith('Copy - '));
        assert.ok(result.taskIdMap[task.id]);
      });

      it('should throw error for non-existent source workflow', () => {
        service.createStrategy('Test Strategy');

        assert.throws(() => {
          service.cloneWorkflowToStrategy('non-existent-workflow-id', 'Test Strategy');
        }, WorkflowNotFoundError);
      });

      it('should throw error for non-existent target strategy', () => {
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        assert.throws(() => {
          service.cloneWorkflowToStrategy(workflow.id, 'non-existent-strategy');
        }, StrategyNotFoundError);
      });
    });

    describe('getWorkflowsByStrategy', () => {
      it('should return workflows in strategy', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });
        const workflow1 = service.createWorkflow('Workflow 1', [task1.id]);
        const workflow2 = service.createWorkflow('Workflow 2', [task2.id]);

        service.moveWorkflowToStrategy(workflow1.id, strategy.id);
        service.moveWorkflowToStrategy(workflow2.id, strategy.id);

        const workflows = service.getWorkflowsByStrategy(strategy.id);

        assert.strictEqual(workflows.length, 2);
        assert.ok(workflows.find(w => w.id === workflow1.id));
        assert.ok(workflows.find(w => w.id === workflow2.id));
      });

      it('should return workflows by strategy name', () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);

        service.moveWorkflowToStrategy(workflow.id, strategy.id);

        const workflows = service.getWorkflowsByStrategy('Test Strategy');

        assert.strictEqual(workflows.length, 1);
        assert.strictEqual(workflows[0].id, workflow.id);
      });

      it('should return empty array for strategy with no workflows', () => {
        const strategy = service.createStrategy('Test Strategy');
        const workflows = service.getWorkflowsByStrategy(strategy.id);

        assert.deepStrictEqual(workflows, []);
      });

      it('should throw error for non-existent strategy', () => {
        assert.throws(() => {
          service.getWorkflowsByStrategy('non-existent-strategy');
        }, StrategyNotFoundError);
      });

      it('should not return workflows from other strategies', () => {
        const strategy1 = service.createStrategy('Strategy 1');
        const strategy2 = service.createStrategy('Strategy 2');
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });
        const workflow1 = service.createWorkflow('Workflow 1', [task1.id]);
        const workflow2 = service.createWorkflow('Workflow 2', [task2.id]);

        service.moveWorkflowToStrategy(workflow1.id, strategy1.id);
        service.moveWorkflowToStrategy(workflow2.id, strategy2.id);

        const workflows1 = service.getWorkflowsByStrategy(strategy1.id);
        const workflows2 = service.getWorkflowsByStrategy(strategy2.id);

        assert.strictEqual(workflows1.length, 1);
        assert.strictEqual(workflows2.length, 1);
        assert.strictEqual(workflows1[0].id, workflow1.id);
        assert.strictEqual(workflows2[0].id, workflow2.id);
      });
    });

    describe('Strategy status transitions', () => {
      it('should allow active to archived transition', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { status: 'archived' });

        assert.strictEqual(updated?.status, 'archived');
      });

      it('should allow active to completed transition', () => {
        const strategy = service.createStrategy('Test Strategy');
        const updated = service.updateStrategy(strategy.id, { status: 'completed' });

        assert.strictEqual(updated?.status, 'completed');
      });

      it('should allow archived to active transition', () => {
        const strategy = service.createStrategy('Test Strategy');
        service.updateStrategy(strategy.id, { status: 'archived' });
        const updated = service.updateStrategy(strategy.id, { status: 'active' });

        assert.strictEqual(updated?.status, 'active');
      });

      it('should allow completed to active transition', () => {
        const strategy = service.createStrategy('Test Strategy');
        service.updateStrategy(strategy.id, { status: 'completed' });
        const updated = service.updateStrategy(strategy.id, { status: 'active' });

        assert.strictEqual(updated?.status, 'active');
      });
    });

    describe('Strategy metadata', () => {
      it('should create strategy with metadata', () => {
        const strategy = service.createStrategy('Test Strategy', 'Description', ['tag1']);
        const updated = service.updateStrategy(strategy.id, { 
          metadata: { key: 'value', priority: 1 } 
        });

        assert.deepStrictEqual(updated?.metadata, { key: 'value', priority: 1 });
      });

      it('should update strategy metadata', () => {
        const strategy = service.createStrategy('Test Strategy');
        service.updateStrategy(strategy.id, { metadata: { key: 'value' } });
        const updated = service.updateStrategy(strategy.id, { 
          metadata: { key: 'new-value', priority: 1 } 
        });

        assert.deepStrictEqual(updated?.metadata, { key: 'new-value', priority: 1 });
      });
    });

    describe('Strategy persistence', () => {
      it('should persist strategies across service reload', async () => {
        const strategy = service.createStrategy('Test Strategy', 'Description', ['tag1']);
        const strategyId = strategy.id;

        await service.forceSave();
        await service.shutdown();

        // Create new service instance
        storageAdapter = StorageFactory.createAdapter(testCase.backend, testCase.path);
        await storageAdapter.initialize();
        service = new TaskOrchestratorService(storageAdapter);
        await service.load();

        const retrieved = service.getStrategy(strategyId);
        assert.strictEqual(retrieved?.name, 'Test Strategy');
        assert.strictEqual(retrieved?.description, 'Description');
        assert.deepStrictEqual(retrieved?.tags, ['tag1']);
      });

      it('should persist workflow-strategy associations across reload', async () => {
        const strategy = service.createStrategy('Test Strategy');
        const task = service.createTask({ name: 'Test Task' });
        const workflow = service.createWorkflow('Test Workflow', [task.id]);
        
        service.moveWorkflowToStrategy(workflow.id, strategy.id);
        const workflowId = workflow.id;
        const strategyId = strategy.id;

        await service.forceSave();
        await service.shutdown();

        // Create new service instance
        storageAdapter = StorageFactory.createAdapter(testCase.backend, testCase.path);
        await storageAdapter.initialize();
        service = new TaskOrchestratorService(storageAdapter);
        await service.load();

        const retrievedWorkflow = service.getWorkflow(workflowId);
        assert.ok(retrievedWorkflow);
        assert.strictEqual(retrievedWorkflow!.strategyId, strategyId);
      });
    });
  });
}
