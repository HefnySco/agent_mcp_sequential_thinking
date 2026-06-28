import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSuccessResponse, createErrorResponse, createToolResponse } from '../src/utils/response.js';

describe('Response Utility Module', () => {
  describe('createSuccessResponse', () => {
    it('should create a success response with data and display output', () => {
      const data = { id: '123', name: 'Test Task' };
      const displayOutput = '✅ Task created successfully';
      const toolName = 'create_task';

      const result = createSuccessResponse(data, displayOutput, toolName);

      assert.strictEqual(result.content.length, 1);
      assert.strictEqual(result.content[0].type, 'text');
      
      const parsed = JSON.parse(result.content[0].text);
      assert.strictEqual(parsed.success, true);
      assert.deepStrictEqual(parsed.data, data);
      assert.strictEqual(parsed.displayOutput, displayOutput);
      assert.strictEqual(parsed.error, null);
      assert.strictEqual(parsed.metadata.tool, toolName);
      assert.ok(parsed.metadata.timestamp);
    });

    it('should include custom metadata in success response', () => {
      const data = { id: '123' };
      const displayOutput = 'Success';
      const toolName = 'test_tool';
      const customMetadata = { userId: 'user1', requestId: 'req1' };

      const result = createSuccessResponse(data, displayOutput, toolName, customMetadata);
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.metadata.userId, 'user1');
      assert.strictEqual(parsed.metadata.requestId, 'req1');
    });

    it('should handle null data in success response', () => {
      const result = createSuccessResponse(null, 'Success', 'test');
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.data, null);
    });
  });

  describe('createErrorResponse', () => {
    it('should create an error response with code and message', () => {
      const code = 'VALIDATION_ERROR';
      const message = 'Invalid input';
      const displayOutput = '❌ Validation failed';
      const toolName = 'validate_input';

      const result = createErrorResponse(code, message, displayOutput, toolName);

      assert.strictEqual(result.content.length, 1);
      assert.strictEqual(result.content[0].type, 'text');
      
      const parsed = JSON.parse(result.content[0].text);
      assert.strictEqual(parsed.success, false);
      assert.strictEqual(parsed.data, null);
      assert.strictEqual(parsed.displayOutput, displayOutput);
      assert.deepStrictEqual(parsed.error, { code, message });
      assert.strictEqual(parsed.metadata.tool, toolName);
      assert.ok(parsed.metadata.timestamp);
    });

    it('should include custom metadata in error response', () => {
      const customMetadata = { attempt: 1, context: 'test' };
      const result = createErrorResponse('ERROR', 'msg', 'Error', 'tool', customMetadata);
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.metadata.attempt, 1);
      assert.strictEqual(parsed.metadata.context, 'test');
    });
  });

  describe('createToolResponse', () => {
    it('should create a response with all parameters', () => {
      const params = {
        success: true,
        data: { result: 'ok' },
        displayOutput: 'Operation completed',
        error: null,
        metadata: { custom: 'value' }
      };
      const toolName = 'custom_tool';

      const result = createToolResponse(params, toolName);
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.success, true);
      assert.deepStrictEqual(parsed.data, { result: 'ok' });
      assert.strictEqual(parsed.displayOutput, 'Operation completed');
      assert.strictEqual(parsed.error, null);
      assert.strictEqual(parsed.metadata.tool, toolName);
      assert.strictEqual(parsed.metadata.custom, 'value');
    });

    it('should create a response with error', () => {
      const params = {
        success: false,
        data: null,
        displayOutput: 'Failed',
        error: { code: 'ERR', message: 'Error occurred' }
      };
      const toolName = 'failing_tool';

      const result = createToolResponse(params, toolName);
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.success, false);
      assert.strictEqual(parsed.data, null);
      assert.deepStrictEqual(parsed.error, { code: 'ERR', message: 'Error occurred' });
    });

    it('should use default values for optional parameters', () => {
      const params = { success: true };
      const toolName = 'minimal_tool';

      const result = createToolResponse(params, toolName);
      const parsed = JSON.parse(result.content[0].text);

      assert.strictEqual(parsed.data, null);
      assert.strictEqual(parsed.displayOutput, '');
      assert.strictEqual(parsed.error, null);
      assert.strictEqual(parsed.metadata.tool, toolName);
      assert.ok(parsed.metadata.timestamp);
    });
  });

  describe('Response format consistency', () => {
    it('should always return content array with text type', () => {
      const success = createSuccessResponse({}, 'ok', 'tool');
      const error = createErrorResponse('ERR', 'msg', 'fail', 'tool');

      assert.strictEqual(success.content.length, 1);
      assert.strictEqual(success.content[0].type, 'text');
      assert.strictEqual(error.content.length, 1);
      assert.strictEqual(error.content[0].type, 'text');
    });

    it('should always include timestamp in metadata', () => {
      const result = createSuccessResponse({}, 'ok', 'tool');
      const parsed = JSON.parse(result.content[0].text);

      assert.ok(parsed.metadata.timestamp);
      assert.ok(new Date(parsed.metadata.timestamp).toISOString() === parsed.metadata.timestamp);
    });
  });
});
