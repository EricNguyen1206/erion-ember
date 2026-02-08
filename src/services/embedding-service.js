/**
 * EmbeddingService - Generates vector embeddings for text
 * Supports multiple providers: mock (for testing), openai
 */
export class EmbeddingService {
  constructor(options = {}) {
    this.provider = options.provider || 'mock';
    this.apiKey = options.apiKey || null;
    this.model = options.model || 'text-embedding-3-small';
    this.dimension = options.dimension || 1536;
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @returns {Promise<{embedding: number[], model: string}|null>} Embedding result or null
   */
  async generate(text) {
    if (!this.isConfigured()) {
      return null;
    }

    if (this.provider === 'mock') {
      // Generate deterministic mock embedding based on text hash
      return this._generateMockEmbedding(text);
    }

    if (this.provider === 'openai') {
      return this._generateOpenAIEmbedding(text);
    }

    return null;
  }

  /**
   * Check if service is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    if (this.provider === 'mock') {
      return true; // Mock always works
    }
    return Boolean(this.apiKey);
  }

  /**
   * Generate deterministic mock embedding
   * @private
   */
  _generateMockEmbedding(text) {
    // Create a deterministic embedding based on text content
    // This ensures same text = same embedding for testing
    const embedding = new Array(this.dimension);
    let seed = 0;
    
    for (let i = 0; i < text.length; i++) {
      seed += text.charCodeAt(i);
    }
    
    for (let i = 0; i < this.dimension; i++) {
      // Simple pseudo-random based on seed
      const x = Math.sin(seed + i * 12.9898) * 43758.5453;
      embedding[i] = x - Math.floor(x);
    }
    
    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = embedding.map(val => val / magnitude);
    
    return {
      embedding: normalized,
      model: 'mock-embedding-model'
    };
  }

  /**
   * Generate embedding using OpenAI API
   * @private
   */
  async _generateOpenAIEmbedding(text) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Embedding API error:', error);
        return null;
      }

      const data = await response.json();
      
      return {
        embedding: data.data[0].embedding,
        model: this.model
      };
    } catch (err) {
      console.error('Failed to generate embedding:', err.message);
      return null;
    }
  }
}

export default EmbeddingService;
