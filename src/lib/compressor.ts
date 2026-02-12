import lz4js from 'lz4js';

/**
 * LZ4 Compressor - Fast compression for text data
 */
export class Compressor {
  /**
   * Compress string using LZ4
   * @param data - String to compress
   * @returns Compressed data buffer
   */
  compress(data: string): Buffer {
    if (!data || data.length === 0) {
      return Buffer.alloc(0);
    }

    const input = Buffer.from(data, 'utf8');
    const compressed = lz4js.compress(input);
    return Buffer.from(compressed);
  }

  /**
   * Decompress LZ4 data
   * @param data - Compressed data
   * @param originalSize - Original uncompressed size (for compatibility)
   * @returns Decompressed string
   */
  decompress(data: Buffer, originalSize: number): string {
    if (!data || data.length === 0) {
      return '';
    }

    const decompressed = lz4js.decompress(data);
    return Buffer.from(decompressed).toString('utf8');
  }
}

export default Compressor;
