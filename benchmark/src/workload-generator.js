const fs = require('fs');
const path = require('path');

/**
 * Generates benchmark workloads with semantic variations
 */
class WorkloadGenerator {
  constructor(dataPath = null) {
    this.dataPath = dataPath || path.join(__dirname, '..', 'data', 'workloads.json');
    this.workloads = this._loadWorkloads();
  }

  _loadWorkloads() {
    const data = fs.readFileSync(this.dataPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Generate RAG (Retrieval-Augmented Generation) queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateRAG(count) {
    const queries = [];
    const templates = this.workloads.rag.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const topic = template.topics[i % template.topics.length];
      
      const baseQuery = template.base.replace('{topic}', topic);
      queries.push({
        id: `rag-${i}`,
        type: 'rag',
        query: baseQuery,
        category: topic,
        semanticGroup: baseQuery
      });
    }
    
    return queries;
  }

  /**
   * Generate classification queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateClassification(count) {
    const queries = [];
    const templates = this.workloads.classification.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const text = template.texts[i % template.texts.length];
      
      queries.push({
        id: `class-${i}`,
        type: 'classification',
        text: text,
        category: template.category,
        expectedCategory: template.category,
        semanticGroup: text
      });
    }
    
    return queries;
  }

  /**
   * Generate code generation queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateCode(count) {
    const queries = [];
    const templates = this.workloads.code.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const prompt = template.prompts[i % template.prompts.length];
      
      queries.push({
        id: `code-${i}`,
        type: 'code',
        prompt: prompt,
        language: template.language,
        semanticGroup: `${template.language}: ${prompt}`
      });
    }
    
    return queries;
  }

  /**
   * Generate mixed workload
   * @param {Object} distribution - Query type distribution
   * @returns {Array} - Mixed query objects
   */
  generateMixed(distribution = { rag: 400, classification: 300, code: 300 }) {
    const queries = [
      ...this.generateRAG(distribution.rag || 0),
      ...this.generateClassification(distribution.classification || 0),
      ...this.generateCode(distribution.code || 0)
    ];
    
    // Shuffle queries
    for (let i = queries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queries[i], queries[j]] = [queries[j], queries[i]];
    }
    
    return queries;
  }

  /**
   * Create semantic variations of a query
   * @param {Object} baseQuery - Base query object
   * @param {number} count - Number of variations
   * @returns {Array} - Variation objects
   */
  createVariations(baseQuery, count) {
    const variations = [];
    
    const queryText = baseQuery.query || baseQuery.text || baseQuery.prompt;
    
    // Variation strategies that always produce different results
    const strategies = [
      (q) => `Tell me about ${q.replace(/What is\s+/i, '').replace(/How does\s+/i, '').replace(/\?$/, '')}`,
      (q) => `Can you explain: ${q}`,
      (q) => `I need to know: ${q}`,
      (q) => `Could you tell me ${q.charAt(0).toLowerCase() + q.slice(1)}`,
      (q) => `What do you know about ${q.replace(/What is\s+/i, '').replace(/How does\s+/i, '').replace(/\?$/, '')}?`,
      (q) => `Please explain ${q.replace(/What is\s+/i, '').replace(/How does\s+/i, '').replace(/\?$/, '')}`,
      (q) => `I'm curious about: ${q}`
    ];
    
    let strategyIndex = 0;
    
    for (let i = 0; i < count; i++) {
      // Find a strategy that produces a different result
      let varied = queryText;
      let attempts = 0;
      
      while (varied === queryText && attempts < strategies.length) {
        const strategy = strategies[strategyIndex % strategies.length];
        varied = strategy(queryText);
        strategyIndex++;
        attempts++;
      }
      
      // If still same, force a difference by adding prefix
      if (varied === queryText) {
        varied = `Query: ${queryText}`;
      }
      
      variations.push({
        ...baseQuery,
        id: `${baseQuery.id}-var-${i}`,
        query: varied,
        text: varied,
        prompt: varied,
        isVariation: true,
        semanticGroup: baseQuery.semanticGroup || queryText
      });
    }
    
    return variations;
  }
}

module.exports = WorkloadGenerator;
