import VectorIndex from './interface.js';

/**
 * Create vector index instance
 * @param {object} options - Configuration options
 * @param {number} options.dim - Vector dimension
 * @param {number} options.maxElements - Maximum number of elements
 * @param {string} options.space - Distance metric ('cosine', 'l2', 'ip')
 * @param {string} options.backend - Backend type ('annoy' or 'hnsw')
 * @returns {Promise<VectorIndex>} Vector index instance
 */
export async function createVectorIndex(options = {}) {
  const { dim, maxElements, space = 'cosine' } = options;
  
  // Determine backend: option > environment variable > default
  const backend = options.backend || process.env.VECTOR_INDEX_BACKEND || 'annoy';

  // Explicitly validate supported backends
  const supportedBackends = ['annoy', 'hnsw'];
  if (!supportedBackends.includes(backend)) {
    throw new Error(`Unknown vector index backend: ${backend}. Use 'annoy' or 'hnsw'.`);
  }

  if (backend === 'annoy') {
    // Dynamically import AnnoyVectorIndex
    const { default: AnnoyVectorIndex } = await import('./annoy-index.js');
    return new AnnoyVectorIndex(dim, maxElements, space);
  }

  if (backend === 'hnsw') {
    // Dynamically import HNSWVectorIndex
    try {
      const { default: HNSWVectorIndex } = await import('./hnsw-index.js');
      return new HNSWVectorIndex(dim, maxElements, space);
    } catch (err) {
      throw new Error(
        `hnswlib-node not available. ` +
        `Install C++ build tools or use Annoy.js backend (VECTOR_INDEX_BACKEND=annoy). ` +
        `Original error: ${err.message}`
      );
    }
  }
}

export { VectorIndex };
export default createVectorIndex;
