import { pipeline } from '@huggingface/transformers';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const DIMENSION = 384;

export class EmbeddingService {
  constructor() {
    this.dimension = DIMENSION;
    this._extractor = null;
  }

  async generate(text) {
    if (!this._extractor) {
      this._extractor = await pipeline('feature-extraction', MODEL, { dtype: 'fp32' });
    }
    const output = await this._extractor(text, { pooling: 'mean', normalize: true });
    return {
      embedding: Array.from(output.data),
      model: MODEL,
    };
  }
}

export default EmbeddingService;
