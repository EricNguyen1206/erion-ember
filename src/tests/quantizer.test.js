import Quantizer from '../lib/quantizer.js';

describe('Quantizer', () => {
  let quantizer;

  beforeEach(() => {
    quantizer = new Quantizer('int8');
  });

  test('should quantize FP32 vector to INT8', () => {
    const vector = [0.5, -0.5, 0.0, 1.0, -1.0];
    const quantized = quantizer.quantize(vector);
    
    expect(quantized).toBeInstanceOf(Array);
    expect(quantized.length).toBe(5);
    expect(quantized.every(v => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
  });

  test('should dequantize INT8 back to FP32', () => {
    const original = [0.5, -0.5, 0.0, 1.0, -1.0];
    const quantized = quantizer.quantize(original);
    const dequantized = quantizer.dequantize(quantized);
    
    expect(dequantized.length).toBe(5);
    // Check approximate equality (precision loss expected)
    dequantized.forEach((val, i) => {
      expect(Math.abs(val - original[i])).toBeLessThan(0.01);
    });
  });

  test('should handle edge cases', () => {
    expect(quantizer.quantize([2.0])).toEqual([255]); // Clamped to max
    expect(quantizer.quantize([-2.0])).toEqual([0]);  // Clamped to min
  });
});
