import { describe, test, beforeAll, afterAll } from 'bun:test';
import assert from 'node:assert';

describe('HTTP Server', () => {
  test('should start server on port 3000', async () => {
    // This will fail until we implement server
    const response = await fetch('http://localhost:3000/health');
    assert.strictEqual(response.status, 200);
  });

  test('POST /v1/chat should accept prompt and model', async () => {
    const response = await fetch('http://localhost:3000/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'What is machine learning?',
        model: 'llama3.2'
      })
    });
    
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.response);
    assert.ok(data.cached !== undefined);
  });
});
