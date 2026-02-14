import XXH from 'xxhashjs';

/**
 * Prompt Normalizer - Normalizes text for deduplication
 */
export class Normalizer {
  private seed: number;

  constructor() {
    this.seed = 0;
  }

  /**
   * Normalize text for caching
   * - Lowercase
   * - Trim
   * - Remove extra spaces
   * @param text - Input text
   * @returns Normalized text
   */
  normalize(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Generate hash for deduplication
   * Uses xxhash for speed (10x faster than sha256)
   * @param text - Input text (will be normalized if not already)
   * @param alreadyNormalized - If true, assumes text is already normalized
   * @returns Hash string
   */
  hash(text: string, alreadyNormalized: boolean = false): string {
    const normalized = alreadyNormalized ? text : this.normalize(text);
    const hasher = XXH.h64(this.seed);
    hasher.update(normalized);
    return hasher.digest().toString(16);
  }
}

export default Normalizer;
