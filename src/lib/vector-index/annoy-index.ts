import Annoy from 'annoy.js';
import fs from 'fs/promises';
import VectorIndex from './interface.js';
import { DistanceMetric, SearchResult } from '../../types/index.js';

/**
 * AnnoyVectorIndex - Pure JavaScript vector similarity search
 * Uses Annoy.js (binary tree based ANN) - no native dependencies
 */
export class AnnoyVectorIndex extends VectorIndex {
  private annoy: Annoy | null = null;
  private currentId: number;
  private built: boolean;
  private destroyed: boolean = false;

  // Annoy parameters
  private readonly forestSize: number = 10;
  private readonly maxLeafSize: number = 100;

  constructor(dim: number, maxElements: number, space: DistanceMetric = 'cosine') {
    super(dim, maxElements, space);
    this.currentId = 0;
    this.built = false;

    this.annoy = new Annoy(this.forestSize, dim, this.maxLeafSize);
  }

  /**
   * Add vector to index
   * @param vector - Vector to add
   * @param id - Optional ID (auto-increment if not provided)
   * @returns ID of added item
   */
  addItem(vector: number[], id?: number): number {
    if (this.destroyed || !this.annoy) {
      throw new Error('Cannot add item: index has been destroyed');
    }

    const itemId = id !== undefined ? id : this.currentId;

    this.annoy.add({
      v: vector,
      d: itemId,
    });

    this.built = false;
    this.currentId = Math.max(this.currentId, itemId + 1);

    return itemId;
  }

  /**
   * Search for nearest neighbors
   * @param queryVector - Query vector
   * @param k - Number of results
   * @returns Search results
   */
  search(queryVector: number[], k: number = 5): SearchResult[] {
    if (this.destroyed || !this.annoy || this.currentId === 0) {
      return [];
    }

    if (!this.built) {
      this.built = true;
    }

    const results = this.annoy.get(queryVector, k);

    return results.map((result) => {
      // annoy.js returns {d: id, v: vector} format
      const resultId = result.d ?? result.data;
      if (resultId === undefined) {
        throw new Error('Annoy.js result missing id; cannot map search result safely.');
      }
      const resultVector = result.v ?? result.vector;

      if (!resultVector || !Array.isArray(resultVector)) {
        throw new Error(
          `Annoy.js did not return vector for result ${resultId}. ` +
          'The annoy.js library version may not support returning vectors in search results. ' +
          'Consider using HNSW backend instead, or ensure vectors are stored separately.'
        );
      }

      const distance = this._calculateDistance(queryVector, resultVector);

      return {
        id: resultId,
        distance: distance,
      };
    });
  }

  /**
   * Calculate distance between two vectors based on the configured metric
   * @private
   */
  private _calculateDistance(vec1: number[], vec2: number[]): number {
    if (this.space === 'cosine') {
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
      }

      if (norm1 === 0 || norm2 === 0) return 1;
      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return 1 - similarity;
    } else if (this.space === 'ip') {
      // Inner product: larger dot product = more similar
      // Return negative dot product so smaller distance = more similar
      let dotProduct = 0;
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
      }
      return -dotProduct;
    } else {
      // L2 (Euclidean) distance
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
   * @param path - File path
   */
  async save(path: string): Promise<void> {
    if (this.destroyed || !this.annoy) {
      throw new Error('Cannot save: index has been destroyed');
    }

    const json = this.annoy.toJson();
    const data = {
      dim: this.dim,
      maxElements: this.maxElements,
      space: this.space,
      currentId: this.currentId,
      annoyJson: json,
    };

    await fs.writeFile(path, JSON.stringify(data));
  }

  /**
   * Load index from file
   * @param path - File path
   */
  async load(path: string): Promise<void> {
    const fileContent = await fs.readFile(path, 'utf8');
    const data: {
      dim: number;
      maxElements: number;
      space: DistanceMetric;
      currentId: number;
      annoyJson: string;
    } = JSON.parse(fileContent);

    this.dim = data.dim;
    this.maxElements = data.maxElements;
    this.space = data.space;
    this.currentId = data.currentId;

    this.annoy = new Annoy(this.forestSize, this.dim, this.maxLeafSize);
    this.annoy.fromJson(JSON.stringify(data.annoyJson));
    this.built = true;
    this.destroyed = false;
  }

  destroy(): void {
    this.annoy = null;
    this.built = false;
    this.currentId = 0;
    this.destroyed = true;
  }

  getCount(): number {
    return this.currentId;
  }
}

export default AnnoyVectorIndex;
