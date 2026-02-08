import Normalizer from '../src/lib/normalizer.js';

describe('Normalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  test('should normalize basic text', () => {
    expect(normalizer.normalize('  Hello World  ')).toBe('hello world');
  });

  test('should lowercase text', () => {
    expect(normalizer.normalize('HELLO')).toBe('hello');
  });

  test('should remove extra spaces', () => {
    expect(normalizer.normalize('hello    world')).toBe('hello world');
  });

  test('should generate consistent hash', () => {
    const text1 = 'Hello World';
    const text2 = '  hello   world  ';
    
    expect(normalizer.hash(text1)).toBe(normalizer.hash(text2));
  });

  test('should generate different hashes for different texts', () => {
    const hash1 = normalizer.hash('hello');
    const hash2 = normalizer.hash('world');
    
    expect(hash1).not.toBe(hash2);
  });
});
