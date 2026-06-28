import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TaskOrchestratorService } from '../src/taskOrchestratorService.js';
import { resetConfigManager } from '../src/config.js';
import { StorageFactory } from '../src/storage/StorageFactory.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_JSON_STORAGE_PATH = path.join(__dirname, 'test-storage-bundle.json');

const testCases = [
  { name: 'JSON Storage', backend: 'json' as const, path: TEST_JSON_STORAGE_PATH }
];

for (const testCase of testCases) {
  describe(`Workflow Bundle Export/Import with ${testCase.name}`, () => {
    let service: TaskOrchestratorService;
    let storageAdapter: any;

    beforeEach(async () => {
      resetConfigManager();
      process.env.TASK_ORCHESTRATOR_AUTO_SAVE = 'false';
      storageAdapter = StorageFactory.createAdapter(testCase.backend, testCase.path);
      await storageAdapter.initialize();
      service = new TaskOrchestratorService(storageAdapter);
      await service.load();
    });

    afterEach(async () => {
      await service.forceSave();
      await service.shutdown();
      await service.clearAll();
      await storageAdapter.close();
      try {
        await fs.unlink(testCase.path);
      } catch {
        // File might not exist
      }
    });

    describe('exportWorkflowBundle', () => {
      it('should export a simple workflow with basic tasks', () => {
        const tasks = service.createTasks([
          { name: 'Task 1' },
          { name: 'Task 2' },
          { name: 'Task 3' }
        ]);

        const workflow = service.createWorkflow('Test Workflow', tasks.map(t => t.id));
        const bundle = service.exportWorkflowBundle(workflow.id);

        assert.ok(bundle);
        assert.strictEqual(bundle.workflow.name, 'Test Workflow');
        assert.strictEqual(bundle.tasks.length, 3);
        assert.strictEqual(bundle.version, '1.0.0');
        assert.ok(bundle.exportedAt);
        assert.strictEqual(bundle.templateName, 'Test Workflow');
      });

      it('should export a workflow with subtasks (hierarchical structure)', () => {
        const parentTask = service.createTask({ name: 'Parent Task' });
        const childTasks = service.createTasks([
          { name: 'Child Task 1', parentTaskId: parentTask.id },
          { name: 'Child Task 2', parentTaskId: parentTask.id }
        ]);

        const workflow = service.createWorkflow('Hierarchical Workflow', [parentTask.id, ...childTasks.map(t => t.id)]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        assert.ok(bundle);
        assert.strictEqual(bundle.tasks.length, 3); // Parent + 2 children
        assert.ok(bundle.tasks.some(t => t.name === 'Parent Task'));
        assert.ok(bundle.tasks.some(t => t.name === 'Child Task 1'));
        assert.ok(bundle.tasks.some(t => t.name === 'Child Task 2'));
      });

      it('should export a workflow with rich dependencies', () => {
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ 
          name: 'Task 2', 
          dependencies: [{ taskId: task1.id, type: 'hard', onFailure: 'block' }] 
        });
        const task3 = service.createTask({ 
          name: 'Task 3', 
          dependencies: [{ taskId: task1.id, type: 'soft' }] 
        });

        const workflow = service.createWorkflow('Complex Workflow', [task1.id, task2.id, task3.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        assert.ok(bundle);
        assert.strictEqual(bundle.tasks.length, 3);
        
        const exportedTask2 = bundle.tasks.find(t => t.name === 'Task 2');
        assert.ok(exportedTask2);
        assert.ok(Array.isArray(exportedTask2?.dependencies));
        assert.strictEqual(exportedTask2?.dependencies.length, 1);
      });

      it('should throw error when exporting non-existent workflow', () => {
        assert.throws(() => {
          service.exportWorkflowBundle('non-existent-workflow-id');
        });
      });
    });

    describe('importWorkflowBundle', () => {
      it('should import a basic workflow bundle', () => {
        const task1 = service.createTask({ name: 'Original Task 1' });
        const task2 = service.createTask({ name: 'Original Task 2' });

        const originalWorkflow = service.createWorkflow('Original Workflow', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(originalWorkflow.id);

        // Clear all to simulate fresh session
        service.clearAll();

        // Import the bundle
        const importResult = service.importWorkflowBundle(bundle);

        assert.ok(importResult);
        assert.ok(importResult.newWorkflowId);
        assert.ok(importResult.taskIdMap);
        assert.strictEqual(Object.keys(importResult.taskIdMap).length, 2);

        // Verify the new workflow exists
        const newWorkflow = service.getWorkflow(importResult.newWorkflowId);
        assert.ok(newWorkflow);
        assert.strictEqual(newWorkflow?.name, 'Original Workflow');
        assert.strictEqual(newWorkflow?.taskIds.length, 2);

        // Verify tasks were created with new IDs
        const allTasks = service.getAllTasks();
        assert.strictEqual(allTasks.length, 2);
        
        // Verify task names are preserved
        assert.ok(allTasks.some(t => t.name === 'Original Task 1'));
        assert.ok(allTasks.some(t => t.name === 'Original Task 2'));
      });

      it('should import with namePrefix option', () => {
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });

        const originalWorkflow = service.createWorkflow('My Workflow', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(originalWorkflow.id);

        service.clearAll();

        const importResult = service.importWorkflowBundle(bundle, { namePrefix: 'Project A - ' });

        const newWorkflow = service.getWorkflow(importResult.newWorkflowId);
        assert.ok(newWorkflow);
        assert.strictEqual(newWorkflow?.name, 'Project A - My Workflow');

        const allTasks = service.getAllTasks();
        assert.strictEqual(allTasks.length, 2);
        assert.ok(allTasks.every(t => t.name.startsWith('Project A - ')));
      });

      it('should import with deduplication strategies', () => {
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });

        const originalWorkflow = service.createWorkflow('Workflow', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(originalWorkflow.id);

        service.clearAll();

        // Test with 'skip' deduplication
        const importResult = service.importWorkflowBundle(bundle, { deduplication: 'skip' });
        assert.ok(importResult);
      });

      it('should handle import/export roundtrip correctly', () => {
        // Create a simple workflow without dependencies for roundtrip test
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });
        const task3 = service.createTask({ name: 'Task 3' });

        const originalWorkflow = service.createWorkflow('Roundtrip Workflow', [task1.id, task2.id, task3.id]);

        // Export
        const bundle = service.exportWorkflowBundle(originalWorkflow.id);

        // Clear and import
        service.clearAll();
        const importResult = service.importWorkflowBundle(bundle);

        // Verify structure is preserved
        const newWorkflow = service.getWorkflow(importResult.newWorkflowId);
        assert.ok(newWorkflow);
        assert.strictEqual(newWorkflow?.name, 'Roundtrip Workflow');
        assert.strictEqual(newWorkflow?.taskIds.length, 3);

        // Verify tasks were recreated
        const allTasks = service.getAllTasks();
        assert.strictEqual(allTasks.length, 3);
        assert.ok(allTasks.some(t => t.name === 'Task 1'));
        assert.ok(allTasks.some(t => t.name === 'Task 2'));
        assert.ok(allTasks.some(t => t.name === 'Task 3'));
      });

      it('should throw error when importing invalid bundle', () => {
        const invalidBundle = {
          workflow: null,
          tasks: [],
          version: '1.0.0',
          exportedAt: new Date().toISOString()
        };

        assert.throws(() => {
          service.importWorkflowBundle(invalidBundle as any);
        });
      });

      it('should remap all task IDs during import', () => {
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });

        const originalWorkflow = service.createWorkflow('ID Remap Test', [task1.id, task2.id]);
        const originalTaskIds = [task1.id, task2.id];

        const bundle = service.exportWorkflowBundle(originalWorkflow.id);
        service.clearAll();

        const importResult = service.importWorkflowBundle(bundle);

        // All original IDs should be mapped to new IDs
        for (const originalId of originalTaskIds) {
          assert.ok(importResult.taskIdMap[originalId]);
          assert.notStrictEqual(importResult.taskIdMap[originalId], originalId);
        }

        // New IDs should be different from original IDs
        const newTaskIds = Object.values(importResult.taskIdMap);
        for (const newId of newTaskIds) {
          assert.ok(!originalTaskIds.includes(newId));
        }
      });

      it('should export with hierarchical task names and name maps', () => {
        const parentTask = service.createTask({ name: 'Parent' });
        const childTask1 = service.createTask({ name: 'Child1', parentTaskId: parentTask.id });
        const childTask2 = service.createTask({ name: 'Child2', parentTaskId: parentTask.id });

        const workflow = service.createWorkflow('Hierarchical', [parentTask.id, childTask1.id, childTask2.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        // Verify name maps exist
        assert.ok(bundle.nameToIdMap);
        assert.ok(bundle.idToNameMap);
        assert.strictEqual(Object.keys(bundle.nameToIdMap || {}).length, 3);
        assert.strictEqual(Object.keys(bundle.idToNameMap || {}).length, 3);

        // Verify qualified names for hierarchical tasks
        assert.ok(bundle.nameToIdMap?.['Parent']);
        assert.ok(bundle.nameToIdMap?.['Parent/Child1']);
        assert.ok(bundle.nameToIdMap?.['Parent/Child2']);

        // Verify tasks have qualifiedName at top level for readability
        const parentInBundle = bundle.tasks.find(t => t.name === 'Parent');
        assert.ok(parentInBundle);
        assert.strictEqual(parentInBundle?.qualifiedName, 'Parent');
        // qualifiedName should NOT be in metadata (removed for cleanup)
        assert.strictEqual(parentInBundle?.metadata?.qualifiedName, undefined);

        const child1InBundle = bundle.tasks.find(t => t.name === 'Child1');
        assert.ok(child1InBundle);
        assert.strictEqual(child1InBundle?.qualifiedName, 'Parent/Child1');
        // qualifiedName should NOT be in metadata (removed for cleanup)
        assert.strictEqual(child1InBundle?.metadata?.qualifiedName, undefined);
      });

      it('should handle name collisions with different parents', () => {
        const parent1 = service.createTask({ name: 'Parent1' });
        const parent2 = service.createTask({ name: 'Parent2' });
        const child1 = service.createTask({ name: 'Child', parentTaskId: parent1.id });
        const child2 = service.createTask({ name: 'Child', parentTaskId: parent2.id });

        const workflow = service.createWorkflow('Name Collision', [parent1.id, parent2.id, child1.id, child2.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        // Both qualified names should exist in nameToIdMap
        assert.ok(bundle.nameToIdMap?.['Parent1/Child']);
        assert.ok(bundle.nameToIdMap?.['Parent2/Child']);

        // Simple name is not mapped to avoid ambiguity (use qualified names instead)
        assert.strictEqual(bundle.nameToIdMap?.['Child'], undefined);
      });

      it('should support humanReadableOnly flag', () => {
        const task1 = service.createTask({ name: 'Task 1' });
        const task2 = service.createTask({ name: 'Task 2' });

        const workflow = service.createWorkflow('Readable Test', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(workflow.id, { humanReadableOnly: true });

        assert.strictEqual(bundle.humanReadableOnly, true);
        assert.ok(bundle.nameToIdMap);
        assert.ok(bundle.idToNameMap);
      });

      it('should support nameRemapping during import', () => {
        const task1 = service.createTask({ name: 'Original Name 1' });
        const task2 = service.createTask({ name: 'Original Name 2' });

        const workflow = service.createWorkflow('Remap Test', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);
        service.clearAll();

        const importResult = service.importWorkflowBundle(bundle, {
          nameRemapping: {
            [task1.id]: 'Renamed Task 1',
            [task2.id]: 'Renamed Task 2'
          }
        });

        const allTasks = service.getAllTasks();
        assert.strictEqual(allTasks.length, 2);
        assert.ok(allTasks.some(t => t.name === 'Renamed Task 1'));
        assert.ok(allTasks.some(t => t.name === 'Renamed Task 2'));
        assert.ok(!allTasks.some(t => t.name.startsWith('Original Name')));
      });

      it('should handle roundtrip with name enrichment', () => {
        const parent = service.createTask({ name: 'Parent' });
        const child = service.createTask({ name: 'Child', parentTaskId: parent.id });

        const workflow = service.createWorkflow('Roundtrip Enriched', [parent.id, child.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        // Verify enrichment
        assert.ok(bundle.nameToIdMap);
        assert.ok(bundle.idToNameMap);
        assert.strictEqual(bundle.idToNameMap?.[parent.id], 'Parent');
        assert.strictEqual(bundle.idToNameMap?.[child.id], 'Parent/Child');

        service.clearAll();

        // Import and verify structure preserved
        const importResult = service.importWorkflowBundle(bundle);
        const newWorkflow = service.getWorkflow(importResult.newWorkflowId);
        assert.ok(newWorkflow);
        assert.strictEqual(newWorkflow?.name, 'Roundtrip Enriched');
        assert.strictEqual(newWorkflow?.taskIds.length, 2);

        const allTasks = service.getAllTasks();
        assert.strictEqual(allTasks.length, 2);
        assert.ok(allTasks.some(t => t.name === 'Parent'));
        assert.ok(allTasks.some(t => t.name === 'Child'));

        // Verify the child has the correct parent
        const importedChild = allTasks.find(t => t.name === 'Child');
        const importedParent = allTasks.find(t => t.name === 'Parent');
        assert.ok(importedChild);
        assert.ok(importedParent);
        assert.strictEqual(importedChild?.parentTaskId, importedParent?.id);
      });

      it('should handle slug-based task IDs during import', () => {
        const task1 = service.createTask({ name: 'First Task' });
        const task2 = service.createTask({ name: 'Second Task', dependencies: [{ taskId: task1.id, type: 'hard' }] });

        const workflow = service.createWorkflow('Slug ID Test', [task1.id, task2.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        service.clearAll();

        // Import should handle slug-based IDs correctly
        const importResult = service.importWorkflowBundle(bundle);
        assert.ok(importResult);
        assert.ok(importResult.newWorkflowId);

        const newWorkflow = service.getWorkflow(importResult.newWorkflowId);
        assert.ok(newWorkflow);
        assert.strictEqual(newWorkflow?.taskIds.length, 2);
      });

      it('should use positional references for dependencies during import', () => {
        const task1 = service.createTask({ name: 'Task A' });
        const task2 = service.createTask({ name: 'Task B', dependencies: [{ taskId: task1.id, type: 'hard' }] });
        const task3 = service.createTask({ name: 'Task C', dependencies: [{ taskId: task2.id, type: 'hard' }] });

        const workflow = service.createWorkflow('Positional Ref Test', [task1.id, task2.id, task3.id]);
        const bundle = service.exportWorkflowBundle(workflow.id);

        service.clearAll();

        const importResult = service.importWorkflowBundle(bundle);
        const allTasks = service.getAllTasks();
        
        // Verify dependency chain is preserved
        const importedTaskA = allTasks.find(t => t.name === 'Task A');
        const importedTaskB = allTasks.find(t => t.name === 'Task B');
        const importedTaskC = allTasks.find(t => t.name === 'Task C');

        assert.ok(importedTaskA);
        assert.ok(importedTaskB);
        assert.ok(importedTaskC);
        assert.strictEqual(importedTaskB?.dependencies.length, 1);
        assert.strictEqual(importedTaskC?.dependencies.length, 1);
      });
    });

    describe('Status-based color coding', () => {
      it('should include CSS class definitions for status colors in mermaid export', () => {
        const task1 = service.createTask({ name: 'Completed Task' });
        const task2 = service.createTask({ name: 'Failed Task' });
        const task3 = service.createTask({ name: 'In Progress Task' });
        const task4 = service.createTask({ name: 'Pending Task' });

        service.executeTask(task1.id);
        service.failTask(task2.id, 'Test error');
        service.markTaskInProgress(task3.id);

        const workflow = service.createWorkflow('Color Test', [task1.id, task2.id, task3.id, task4.id]);
        const mermaid = service.exportMermaid(workflow.id);

        assert.ok(mermaid.includes('classDef green'));
        assert.ok(mermaid.includes('classDef red'));
        assert.ok(mermaid.includes('classDef blue'));
        assert.ok(mermaid.includes('classDef gray'));
      });

      it('should assign correct color classes based on task status', () => {
        const task1 = service.createTask({ name: 'Completed' });
        const task2 = service.createTask({ name: 'Failed' });
        const task3 = service.createTask({ name: 'InProgress' });
        const task4 = service.createTask({ name: 'Pending' });

        service.executeTask(task1.id);
        service.failTask(task2.id, 'Error');
        service.markTaskInProgress(task3.id);

        const workflow = service.createWorkflow('Status Colors', [task1.id, task2.id, task3.id, task4.id]);
        const mermaid = service.exportMermaid(workflow.id);

        // Check that each task has the correct color class
        assert.ok(mermaid.includes(':::green')); // completed
        assert.ok(mermaid.includes(':::red')); // failed
        assert.ok(mermaid.includes(':::blue')); // in_progress
        assert.ok(mermaid.includes(':::gray')); // pending
      });
    });
  });
}
