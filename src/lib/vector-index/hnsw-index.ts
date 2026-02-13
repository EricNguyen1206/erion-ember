import hnswlib from 'hnswlib-node';
import VectorIndex from './interface.js';
import { DistanceMetric, SearchResult } from '../../types/index.js';

// Type for hnswlib HierarchicalNSW class
type HierarchicalNSW = {
  initIndex(maxElements: number, M?: number, efConstruction?: number): void;
  setEf(ef: number): void;
  addPoint(vector: number[], id: number): void;
  searchKnn(vector: number[], k: number): {
    neighbors: number[];
    distances: number[];
  };
  writeIndexSync(path: string): void;
  readIndexSync(path: string): void;
  getCurrentCount(): number;
};

/**
 * HNSWVectorIndex - C++ HNSW implementation
 * Requires hnswlib-node native bindings (use Docker for easiest setup)
 */
export class HNSWVectorIndex extends VectorIndex {
  private index: HierarchicalNSW | null = null;
  private currentId: number;
  private destroyed: boolean = false;

  // HNSW parameters
  private readonly M: number = 16;
  private readonly efConstruction: number = 200;
  private readonly ef: number = 100;

  constructor(dim: number, maxElements: number, space: DistanceMetric = 'cosine') {
    super(dim, maxElements, space);
    this.currentId = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HierarchicalNSWClass = (hnswlib as any).HierarchicalNSW;
    this.index = new HierarchicalNSWClass(space, dim);
    this.index!.initIndex(maxElements, this.M, this.efConstruction);
    this.index!.setEf(this.ef);
  }

  /**
   * Add vector to index
   * @param vector - Vector to add
   * @param id - Optional ID (auto-increment if not provided)
   * @returns ID of added item
   */
  addItem(vector: number[], id?: number): number {
    if (this.destroyed || !this.index) {
      throw new Error('Cannot add item: index has been destroyed');
    }
    const itemId = id !== undefined ? id : this.currentId;
    this.index.addPoint(vector, itemId);

    if (id === undefined) {
      this.currentId = itemId + 1;
    }

    return itemId;
  }

  /**
   * Search for nearest neighbors
   * @param queryVector - Query vector
   * @param k - Number of results
   * @returns Search results
   */
  search(queryVector: number[], k: number = 5): SearchResult[] {
    if (this.destroyed || !this.index) {
      return [];
    }

    const result = this.index.searchKnn(queryVector, k);

    const ids = result.neighbors;
    const distances = result.distances;

    return ids.map((id: number, i: number) => ({
      id,
      distance: distances[i],
    }));
  }

  /**
   * Save index to file
   * @param path - File path
   */
  async save(path: string): Promise<void> {
    if (this.destroyed || !this.index) {
      throw new Error('Cannot save: index has been destroyed');
    }
    this.index.writeIndexSync(path);
  }

  async load(path: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HierarchicalNSWClass = (hnswlib as any).HierarchicalNSW;
    this.index = new HierarchicalNSWClass(this.space, this.dim);
    this.index!.readIndexSync(path);
    this.currentId = this.index!.getCurrentCount();
    this.destroyed = false;
  }

  destroy(): void {
    this.index = null;
    this.destroyed = true;
  }

  getCount(): number {
    return this.currentId;
  }
}

export default HNSWVectorIndex;
