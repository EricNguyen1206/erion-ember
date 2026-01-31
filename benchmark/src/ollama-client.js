/**
 * Ollama API Client for embeddings and LLM inference
 */
class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = options.embeddingModel || 'nomic-embed-text';
    this.llmModel = options.llmModel || 'llama3.2';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Check if Ollama service is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate embedding for text
   * @param {string} text - Input text
   * @returns {Promise<number[]>} - Embedding vector
   */
  async embed(text) {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embeddingModel,
        prompt: text
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  /**
   * Generate LLM response
   * @param {string} prompt - Input prompt
   * @returns {Promise<{response: string, tokens: number}>}
   */
  async generate(prompt) {
    const startTime = Date.now();
    
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.llmModel,
        prompt: prompt,
        stream: false
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    
    // Estimate tokens (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil((prompt.length + data.response.length) / 4);
    
    return {
      response: data.response,
      tokens: estimatedTokens,
      latency: latency
    };
  }
}

module.exports = OllamaClient;
