import { XXHash64 } from 'xxhash-addon';

/**
 * Prompt Normalizer - Normalizes text for deduplication
 */
class Normalizer {
  constructor() {
    this.seed = Buffer.alloc(8, 0);
  }

  /**
   * Normalize text for caching
   * - Lowercase
   * - Trim
   * - Remove extra spaces
   * @param {string} text - Input text
   * @returns {string} Normalized text
   */
  normalize(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Generate hash for deduplication
   * Uses xxhash for speed (10x faster than sha256)
   * @param {string} text - Input text
   * @returns {string} Hash string
   */
  hash(text) {
    const normalized = this.normalize(text);
    const hasher = new XXHash64(this.seed);
    hasher.update(Buffer.from(normalized, 'utf8'));
    return hasher.digest().toString('hex');
  }
}

export default Normalizer;