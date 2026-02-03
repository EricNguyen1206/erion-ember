const lz4 = require('lz4');

/**
 * LZ4 Compressor - Fast compression for text data
 */
class Compressor {
  constructor() {
    this.compressionLevel = 1; // Fastest
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
    const maxSize = lz4.encodeBound(input.length);
    const output = Buffer.alloc(maxSize);
    
    const compressedSize = lz4.encodeBlock(input, output);
    return output.slice(0, compressedSize);
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
    
    const output = Buffer.alloc(originalSize);
    const decompressedSize = lz4.decodeBlock(data, output);
    
    return output.slice(0, decompressedSize).toString('utf8');
  }

  /**
   * Calculate compression ratio
   * @param {string} original - Original data
   * @param {Buffer} compressed - Compressed data
   * @returns {number} Ratio (0-1)
   */
  getCompressionRatio(original, compressed) {
    const originalSize = Buffer.byteLength(original, 'utf8');
    return compressed.length / originalSize;
  }
}

module.exports = Compressor;
