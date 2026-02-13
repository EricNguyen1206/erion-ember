/**
 * Type declarations for native modules without TypeScript definitions
 */

declare module 'hnswlib-node' {
  export interface HierarchicalNSW {
    initIndex(maxElements: number, M?: number, efConstruction?: number): void;
    setEf(ef: number): void;
    addPoint(vector: number[], id: number): void;
    searchKnn(vector: number[], k: number): {
      neighbors: number[];
      distances: number[];
    };
    writeIndexSync(path: string): void;
    readIndexSync(path: string): void;
    getCurrentCount(): number;
  }

  export class HierarchicalNSW {
    constructor(space: string, dim: number);
  }

  const hnswlib: {
    HierarchicalNSW: typeof HierarchicalNSW;
  };

  export default hnswlib;
}

declare module 'xxhash-addon' {
  export class XXHash64 {
    constructor(seed: Buffer);
    update(data: Buffer): void;
    digest(): Buffer;
  }
}

declare module 'annoy.js' {
  export interface AnnoyItem {
    v: number[];
    d: number;
  }

  export interface AnnoyResult {
    vector: number[];
    data: number;
  }

  export default class Annoy {
    constructor(forestSize: number, vectorLength: number, maxLeafSize?: number);
    add(item: AnnoyItem): void;
    get(query: number[], k: number): AnnoyResult[];
    toJson(): unknown;
    fromJson(json: string): void;
  }
}

declare module 'lz4js' {
  export function compress(data: Buffer | Uint8Array): Uint8Array;
  export function decompress(data: Buffer | Uint8Array): Uint8Array;
}
