// Realistic workload data for K6 benchmark
// Based on real LLM query patterns

const RAG_QUERIES = [
  'What is machine learning?',
  'Explain neural networks',
  'How does cloud computing work?',
  'What is Docker?',
  'Tell me about Redis',
  'Explain REST API',
  'What is GraphQL?',
  'How does blockchain work?',
  'What is artificial intelligence?',
  'Explain natural language processing',
  'What is a transformer model?',
  'How does attention mechanism work?',
  'What is BERT?',
  'Explain vector embeddings',
  'What is cosine similarity?',
];

const CLASSIFICATION_TEXTS = [
  'New AI model achieves human-level performance',
  'Tech company announces quantum computing breakthrough',
  'Researchers discover new species in deep ocean',
  'Stock market reaches all-time high',
  'Medical breakthrough promises cure for disease',
  'Space telescope captures unprecedented galaxy images',
  'Software update introduces revolutionary features',
  'Cloud infrastructure experiences major outage',
  'Open source project reaches one million stars',
  'Major corporation reports record quarterly earnings',
];

const CODE_PROMPTS = [
  'Write a function to reverse a string',
  'Create a debounce function',
  'Implement a deep clone function',
  'Write a function to flatten a nested array',
  'Create a LRU cache class',
  'Implement a binary search algorithm',
  'Write a function to validate email addresses',
  'Create a throttle function for API calls',
];

export function getRandomPrompt() {
  const all = [...RAG_QUERIES, ...CLASSIFICATION_TEXTS, ...CODE_PROMPTS];
  return all[Math.floor(Math.random() * all.length)];
}

export function getRandomRAG() {
  return RAG_QUERIES[Math.floor(Math.random() * RAG_QUERIES.length)];
}

export function getRandomClassification() {
  return CLASSIFICATION_TEXTS[Math.floor(Math.random() * CLASSIFICATION_TEXTS.length)];
}

export function getRandomCode() {
  return CODE_PROMPTS[Math.floor(Math.random() * CODE_PROMPTS.length)];
}

export function getAllPrompts() {
  return {
    rag: RAG_QUERIES,
    classification: CLASSIFICATION_TEXTS,
    code: CODE_PROMPTS
  };
}
