import Compressor from '../src/lib/compressor.js';

describe('Compressor', () => {
  let compressor;

  beforeEach(() => {
    compressor = new Compressor();
  });

  test('should compress and decompress text', () => {
    const original = 'This is a test string for compression. '.repeat(100);
    const compressed = compressor.compress(original);
    const decompressed = compressor.decompress(compressed, Buffer.byteLength(original, 'utf8'));
    
    expect(compressed.length).toBeLessThan(original.length);
    expect(decompressed).toBe(original);
  });

  test('should handle empty string', () => {
    const compressed = compressor.compress('');
    const decompressed = compressor.decompress(compressed, 0);
    expect(decompressed).toBe('');
  });
});
