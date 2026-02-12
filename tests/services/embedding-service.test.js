import { describe, test, expect } from 'bun:test';
import EmbeddingService from '../../src/services/embedding-service.js';

describe('EmbeddingService', () => {
  const service = new EmbeddingService();

  test('should have dimension 384', () => {
    expect(service.dimension).toBe(384);
  });

  test('should generate 384-dim embedding', async () => {
    const result = await service.generate('Hello world');
    expect(result).toBeDefined();
    expect(result.embedding.length).toBe(384);
    expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
  }, 30000);

  test('should produce normalized vectors', async () => {
    const result = await service.generate('Test input');
    const magnitude = Math.sqrt(result.embedding.reduce((s, v) => s + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 1);
  }, 30000);

  test('should produce different embeddings for different texts', async () => {
    const a = await service.generate('Hello');
    const b = await service.generate('Goodbye');
    expect(a.embedding).not.toEqual(b.embedding);
  }, 30000);
});
