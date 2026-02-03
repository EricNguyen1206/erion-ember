/**
 * Vector Quantizer - Converts FP32 vectors to INT8 for memory efficiency
 */
class Quantizer {
  constructor(precision = 'int8') {
    this.precision = precision;
    
    if (precision !== 'int8') {
      throw new Error('Only int8 quantization is supported');
    }
  }

  /**
   * Quantize FP32 vector to INT8
   * Maps [-1, 1] to [0, 255]
   * @param {number[]} vector - Array of floats in range [-1, 1]
   * @returns {number[]} Array of integers in range [0, 255]
   */
  quantize(vector) {
    return vector.map(v => {
      // Clamp to [-1, 1]
      const clamped = Math.max(-1, Math.min(1, v));
      // Map to [0, 255]
      return Math.round((clamped + 1) * 127.5);
    });
  }

  /**
   * Dequantize INT8 vector back to FP32
   * Maps [0, 255] to [-1, 1]
   * @param {number[]} quantized - Array of integers in range [0, 255]
   * @returns {number[]} Array of floats in range [-1, 1]
   */
  dequantize(quantized) {
    return quantized.map(v => (v / 127.5) - 1);
  }
}

module.exports = Quantizer;
