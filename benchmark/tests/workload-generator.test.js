const { describe, test } = require('node:test');
const assert = require('node:assert');
const WorkloadGenerator = require('../src/workload-generator');

describe('WorkloadGenerator', () => {
  test('should load workloads from JSON', () => {
    const generator = new WorkloadGenerator();
    assert.ok(generator.workloads);
    assert.ok(generator.workloads.rag);
    assert.ok(generator.workloads.classification);
    assert.ok(generator.workloads.code);
  });

  test('should generate RAG queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateRAG(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].query);
    assert.ok(queries[0].category);
    assert.strictEqual(queries[0].type, 'rag');
  });

  test('should generate classification queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateClassification(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].text);
    assert.ok(queries[0].category);
    assert.strictEqual(queries[0].type, 'classification');
  });

  test('should generate code queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateCode(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].prompt);
    assert.ok(queries[0].language);
    assert.strictEqual(queries[0].type, 'code');
  });

  test('should generate mixed workload', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateMixed({
      rag: 10,
      classification: 10,
      code: 10
    });
    assert.strictEqual(queries.length, 30);
    
    const ragCount = queries.filter(q => q.type === 'rag').length;
    const classCount = queries.filter(q => q.type === 'classification').length;
    const codeCount = queries.filter(q => q.type === 'code').length;
    
    assert.strictEqual(ragCount, 10);
    assert.strictEqual(classCount, 10);
    assert.strictEqual(codeCount, 10);
  });

  test('should create semantic variations', () => {
    const generator = new WorkloadGenerator();
    const base = { query: 'What is the capital of France?' };
    const variations = generator.createVariations(base, 3);
    
    assert.strictEqual(variations.length, 3);
    assert.ok(variations.every(v => v.query !== base.query));
    assert.ok(variations.every(v => v.semanticGroup === base.query));
  });
});
