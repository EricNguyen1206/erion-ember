import xxhash from 'xxhashjs';

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
   * Uses xxhashjs for speed
   * @param text - Input text (will be normalized if not already)
   * @param alreadyNormalized - If true, assumes text is already normalized
   * @returns Hash string
   */
  hash(text: string, alreadyNormalized: boolean = false): string {
    const normalized = alreadyNormalized ? text : this.normalize(text);
    // xxhashjs h64 uses seed 0 by default
    const hash = xxhash.h64(normalized, this.seed);
    return hash.toString(16);
  }
}

export default Normalizer;
