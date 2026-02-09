import lz4js from 'lz4js';

/**
 * LZ4 Compressor - Fast compression for text data
 */
class Compressor {
  constructor() {
    this.compressionLevel = 1; // Fastest (Not configurable in lz4js, but kept for API compatibility)
  }

  /**
   * Compress string using LZ4
   * @param {string} data - String to compress
   * @returns {Buffer} Compressed data
   */
  compress(data) {
    if (!data || data.length === 0) {
      return Buffer.alloc(0);
    }
    
    const input = Buffer.from(data, 'utf8');
    const compressed = lz4js.compress(input);
    return Buffer.from(compressed);
  }

  /**
   * Decompress LZ4 data
   * @param {Buffer} data - Compressed data
   * @param {number} originalSize - Original uncompressed size
   * @returns {string} Decompressed string
   */
  decompress(data, originalSize) {
    if (!data || data.length === 0) {
      return '';
    }
    
    // lz4js.decompress returns a new Uint8Array (or Buffer)
    // It doesn't strictly need originalSize but we keep the signature compatible
    const decompressed = lz4js.decompress(data);
    return Buffer.from(decompressed).toString('utf8');
  }

  /**
   * Calculate compression ratio
   * @param {string} original - Original data
   * @param {Buffer} compressed - Compressed data
   * @returns {number} Ratio (0-1)
   */
  getCompressionRatio(original, compressed) {
    const originalSize = Buffer.byteLength(original, 'utf8');
    if (originalSize === 0) return 0;
    return compressed.length / originalSize;
  }
}

export default Compressor;
