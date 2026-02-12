/**
 * Vector Quantizer - Converts FP32 vectors to INT8 for memory efficiency
 */
export class Quantizer {
  /**
   * Quantize FP32 vector to INT8
   * Maps [-1, 1] to [0, 255]
   * @param vector - Array of floats in range [-1, 1]
   * @returns Array of integers in range [0, 255]
   */
  quantize(vector: number[]): number[] {
    return vector.map((v) => {
      const clamped = Math.max(-1, Math.min(1, v));
      return Math.round((clamped + 1) * 127.5);
    });
  }

  /**
   * Dequantize INT8 vector back to FP32
   * Maps [0, 255] to [-1, 1]
   * @param quantized - Array of integers in range [0, 255]
   * @returns Array of floats in range [-1, 1]
   */
  dequantize(quantized: number[]): number[] {
    return quantized.map((v) => v / 127.5 - 1);
  }
}

export default Quantizer;
