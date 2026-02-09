import hnswlib from 'hnswlib-node';
import VectorIndex from './interface.js';

/**
 * HNSWVectorIndex - C++ HNSW implementation
 * Requires hnswlib-node native bindings (use Docker for easiest setup)
 */
class HNSWVectorIndex extends VectorIndex {
  constructor(dim, maxElements, space = 'cosine') {
    super(dim, maxElements, space);
    this.currentId = 0;
    
    // HNSW parameters
    this.M = 16;              // Connections per layer
    this.efConstruction = 200; // Build accuracy
    this.ef = 100;            // Search accuracy
    
    // Create index with space and dimension only
    this.index = new hnswlib.HierarchicalNSW(space, dim);
    
    // Initialize index with capacity
    this.index.initIndex(maxElements, this.M, this.efConstruction);
    this.index.setEf(this.ef);
  }

  /**
   * Add vector to index
   * @param {number[]} vector - Vector to add
   * @param {number} id - Optional ID (auto-increment if not provided)
   * @returns {number} ID of added item
   */
  addItem(vector, id = null) {
    const itemId = id !== null ? id : this.currentId++;
    this.index.addPoint(vector, itemId);
    
    if (id === null) {
      this.currentId = itemId + 1;
    }
    
    return itemId;
  }

  /**
   * Search for nearest neighbors
   * @param {number[]} queryVector - Query vector
   * @param {number} k - Number of results
   * @returns {Array<{id: number, distance: number}>} Search results
   */
  search(queryVector, k = 5) {
    const result = this.index.searchKnn(queryVector, k);
    
    // Convert to array of objects
    const ids = result.neighbors;
    const distances = result.distances;
    
    return ids.map((id, i) => ({
      id,
      distance: distances[i]
    }));
  }

  /**
   * Save index to file
   * @param {string} path - File path
   */
  save(path) {
    this.index.writeIndexSync(path);
  }

  /**
   * Load index from file
   * @param {string} path - File path
   */
  load(path) {
    // Create new index instance and load
    this.index = new hnswlib.HierarchicalNSW(this.space, this.dim);
    this.index.readIndexSync(path);
    // Update currentId based on loaded index
    this.currentId = this.index.getCurrentCount();
  }

  /**
   * Destroy index and free memory
   */
  destroy() {
    this.index = null;
  }

  /**
   * Get number of items in index
   * @returns {number}
   */
  getCount() {
    return this.currentId;
  }
}

export default HNSWVectorIndex;
