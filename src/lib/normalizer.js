const crypto = require('crypto');

/**
 * Prompt Normalizer - Normalizes text for deduplication
 */
class Normalizer {
  constructor() {
    // Using Node.js built-in crypto
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
      .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
  }

  /**
   * Generate hash for deduplication
   * @param {string} text - Input text
   * @returns {string} Hash string
   */
  hash(text) {
    const normalized = this.normalize(text);
    return crypto.createHash('sha256')
      .update(normalized, 'utf8')
      .digest('hex');
  }
}

module.exports = Normalizer;
