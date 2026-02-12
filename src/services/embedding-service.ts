import { pipeline } from '@huggingface/transformers';
import { EmbeddingResult } from '../types/index.js';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const DIMENSION = 384;

export class EmbeddingService {
  readonly dimension: number;
  private _extractor: unknown | null = null;

  constructor() {
    this.dimension = DIMENSION;
  }

  async generate(text: string): Promise<EmbeddingResult> {
    if (!this._extractor) {
      this._extractor = await pipeline('feature-extraction', MODEL, { dtype: 'fp32' });
    }
    const extractor = this._extractor as {
      (text: string, options: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
    };
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return {
      embedding: Array.from(output.data),
      model: MODEL,
    };
  }
}

export default EmbeddingService;
