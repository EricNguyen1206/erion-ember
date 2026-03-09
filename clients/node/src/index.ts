export interface CacheSetRequest {
  prompt: string;
  response: string;
  ttl?: number;
}

export interface CacheSetResponse {
  status: string;
  hits?: number;
  [key: string]: any;
}

export interface CacheGetRequest {
  prompt: string;
  similarity_threshold?: number;
}

export interface CacheGetResponse {
  response?: string;
  similarity?: number;
  [key: string]: any;
}

export interface StatsResponse {
  total_items: number;
  [key: string]: any;
}

export class EmberError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'EmberError';
  }
}

export class Ember {
  private baseUrl: string;

  constructor(host: string = 'localhost', port: number = 8080, scheme: string = 'http') {
    this.baseUrl = `${scheme}://${host}:${port}/v1`;
  }

  /**
   * Store a prompt and response pair in the cache.
   * @param request The cache set request containing prompt, response, and optional TTL.
   * @returns A promise that resolves to the server response.
   */
  async set(request: CacheSetRequest): Promise<CacheSetResponse> {
    const res = await fetch(`${this.baseUrl}/cache/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        response: request.response,
        ttl: request.ttl ?? 3600,
      }),
    });

    if (!res.ok) {
      throw new EmberError(res.status, `Failed to set cache: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Retrieve a cached response using semantic similarity.
   * @param request The cache get request containing the prompt and optional similarity threshold.
   * @returns A promise that resolves to the cached response.
   */
  async get(request: CacheGetRequest): Promise<CacheGetResponse> {
    const res = await fetch(`${this.baseUrl}/cache/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        similarity_threshold: request.similarity_threshold ?? 0.8,
      }),
    });

    if (!res.ok) {
      throw new EmberError(res.status, `Failed to get cache: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * View cache statistics and hit rates.
   * @returns A promise that resolves to the current cache statistics.
   */
  async stats(): Promise<StatsResponse> {
    const res = await fetch(`${this.baseUrl}/stats`);

    if (!res.ok) {
      throw new EmberError(res.status, `Failed to fetch stats: ${res.statusText}`);
    }

    return res.json();
  }
}
