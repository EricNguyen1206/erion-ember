/**
 * VectorIndex Interface
 * Abstract interface for vector similarity search implementations
 */
export class VectorIndex {
  constructor(dim, maxElements, space = 'cosine') {
    if (new.target === VectorIndex) {
      throw new Error('VectorIndex is abstract - cannot instantiate directly');
    }
    this.dim = dim;
    this.maxElements = maxElements;
    this.space = space;
  }

  /**
   * Add vector to index
   * @param {number[]} vector - Vector to add
   * @param {number} id - Item ID
   * @returns {number} ID of added item
   */
  addItem(vector, id) {
    throw new Error('addItem must be implemented');
  }

  /**
   * Search for nearest neighbors
   * @param {number[]} queryVector - Query vector
   * @param {number} k - Number of results
   * @returns {Array<{id: number, distance: number}>} Search results
   */
  search(queryVector, k = 5) {
    throw new Error('search must be implemented');
  }

  /**
   * Save index to file
   * @param {string} path - File path
   */
  async save(path) {
    throw new Error('save must be implemented');
  }

  /**
   * Load index from file
   * @param {string} path - File path
   */
  async load(path) {
    throw new Error('load must be implemented');
  }

  /**
   * Destroy index and free memory
   */
  destroy() {
    throw new Error('destroy must be implemented');
  }

  /**
   * Get number of items in index
   * @returns {number}
   */
  getCount() {
    throw new Error('getCount must be implemented');
  }
}

export default VectorIndex;
