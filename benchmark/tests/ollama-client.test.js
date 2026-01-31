const { describe, test } = require('node:test');
const assert = require('node:assert');
const OllamaClient = require('../src/ollama-client');

describe('OllamaClient', () => {
  test('should instantiate with default config', () => {
    const client = new OllamaClient();
    assert.strictEqual(client.baseUrl, 'http://localhost:11434');
    assert.strictEqual(client.embeddingModel, 'nomic-embed-text');
    assert.strictEqual(client.llmModel, 'llama3.2');
  });

  test('should accept custom config', () => {
    const client = new OllamaClient({
      baseUrl: 'http://custom:11434',
      embeddingModel: 'custom-embed',
      llmModel: 'custom-llm'
    });
    assert.strictEqual(client.baseUrl, 'http://custom:11434');
    assert.strictEqual(client.embeddingModel, 'custom-embed');
    assert.strictEqual(client.llmModel, 'custom-llm');
  });

  test('should check availability', async () => {
    const client = new OllamaClient();
    const isAvailable = await client.isAvailable();
    assert.strictEqual(typeof isAvailable, 'boolean');
  });
});
