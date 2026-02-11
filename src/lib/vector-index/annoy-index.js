import Annoy from 'annoy.js';
import { promises as fs } from 'fs';
import VectorIndex from './interface.js';

/**
 * AnnoyVectorIndex - Pure JavaScript vector similarity search
 * Uses Annoy.js (binary tree based ANN) - no native dependencies
 */
class AnnoyVectorIndex extends VectorIndex {
  constructor(dim, maxElements, space = 'cosine') {
    super(dim, maxElements, space);
    this.currentId = 0;
    this.built = false;
    
    // Annoy parameters
    this.forestSize = 10;      // Number of trees
    this.maxLeafSize = 100;    // Max points per leaf
    
    // Create Annoy index
    // Annoy constructor: Annoy(forestSize, vectorLength, maxLeafSize)
    this.annoy = new Annoy(this.forestSize, dim, this.maxLeafSize);
  }

  /**
   * Add vector to index
   * @param {number[]} vector - Vector to add
   * @param {number} id - Optional ID (auto-increment if not provided)
   * @returns {number} ID of added item
   */
  addItem(vector, id = null) {
    const itemId = id !== null ? id : this.currentId;
    
    // Annoy expects { v: number[], d: any }
    this.annoy.add({
      v: vector,
      d: itemId
    });
    
    // Mark as needing rebuild
    this.built = false;
    
    // Always increment currentId to track total items
    this.currentId = Math.max(this.currentId, itemId + 1);
    
    return itemId;
  }

  /**
   * Search for nearest neighbors
   * @param {number[]} queryVector - Query vector
   * @param {number} k - Number of results
   * @returns {Array<{id: number, distance: number}>} Search results
   */
  search(queryVector, k = 5) {
    if (this.currentId === 0) {
      return [];
    }
    
    // Build index if not already built
    if (!this.built) {
      // Annoy builds automatically on first query, but we track it
      this.built = true;
    }
    
    // Get K approximate nearest neighbors
    // Returns array of { vector, data }
    const results = this.annoy.get(queryVector, k);
    
    // Convert to standard format: {id, distance}
    // Note: Annoy returns angular distance or euclidean distance
    // We'll normalize to a 0-1 similarity-like metric
    return results.map(result => {
      // Calculate cosine distance from the result
      // For cosine similarity: distance = 1 - similarity
      const distance = this._calculateDistance(queryVector, result.v);
      
      return {
        id: result.d,
        distance: distance
      };
    });
  }

  /**
   * Calculate cosine distance between two vectors
   * @private
   */
  _calculateDistance(vec1, vec2) {
    if (this.space === 'cosine') {
      // Cosine distance = 1 - cosine similarity
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
      }
      
      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return 1 - similarity;
    } else {
      // Euclidean distance
      let sum = 0;
      for (let i = 0; i < vec1.length; i++) {
        const diff = vec1[i] - vec2[i];
        sum += diff * diff;
      }
      return Math.sqrt(sum);
    }
  }

  /**
   * Save index to file (JSON format)
   * @param {string} path - File path
   */
  async save(path) {
    // Annoy.js supports toJson() for serialization
    const json = this.annoy.toJson();
    const data = {
      dim: this.dim,
      maxElements: this.maxElements,
      space: this.space,
      currentId: this.currentId,
      annoyJson: json
    };
    
    await fs.writeFile(path, JSON.stringify(data));
  }

  /**
   * Load index from file
   * @param {string} path - File path
   */
  async load(path) {
    const data = JSON.parse(await fs.readFile(path, 'utf8'));
    
    this.dim = data.dim;
    this.maxElements = data.maxElements;
    this.space = data.space;
    this.currentId = data.currentId;
    
    // Rebuild Annoy index from JSON
    this.annoy = new Annoy(this.forestSize, this.dim, this.maxLeafSize);
    this.annoy.fromJson(JSON.stringify(data.annoyJson));
    this.built = true;
  }

  /**
   * Destroy index and free memory
   */
  destroy() {
    this.annoy = null;
    this.built = false;
    this.currentId = 0;
  }

  /**
   * Get number of items in index
   * @returns {number}
   */
  getCount() {
    return this.currentId;
  }
}

export default AnnoyVectorIndex;
