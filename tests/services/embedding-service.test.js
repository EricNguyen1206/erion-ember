import { describe, test, expect, beforeEach } from 'bun:test';
import EmbeddingService from '../../src/services/embedding-service.js';

describe('EmbeddingService', () => {
  let service;

  beforeEach(() => {
    service = new EmbeddingService({
      provider: 'mock',
      apiKey: 'test-key'
    });
  });

  test('should generate embedding for text', async () => {
    const result = await service.generate('Hello world');
    
    expect(result).toBeDefined();
    expect(Array.isArray(result.embedding)).toBe(true);
    expect(result.embedding.length).toBe(1536);
  });

  test('should honor model override', async () => {
    const result = await service.generate('Hello world', 'test-model');
    
    expect(result).toBeDefined();
    expect(result.model).toBe('test-model');
  });

  test('should return null when provider not configured', async () => {
    const unconfiguredService = new EmbeddingService({
      provider: 'openai',
      apiKey: null
    });
    
    const result = await unconfiguredService.generate('Hello');
    expect(result).toBeNull();
  });

  test('should check if service is configured', () => {
    expect(service.isConfigured()).toBe(true);
    
    const unconfigured = new EmbeddingService({
      provider: 'openai',
      apiKey: null
    });
    expect(unconfigured.isConfigured()).toBe(false);
  });
});
