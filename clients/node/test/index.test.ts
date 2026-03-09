import { Ember, EmberError, CacheSetRequest, CacheGetRequest } from '../src';

// Polyfill fetch for Jest since Node 16/17 might not have it globally by default in tests
// For Node 18+, native fetch is available but we still need to mock it.
global.fetch = jest.fn();

describe('Ember Client', () => {
  let ember: Ember;

  beforeEach(() => {
    ember = new Ember('localhost', 8080);
    jest.resetAllMocks();
  });

  it('should successfully set cache', async () => {
    const mockResponse = { status: 'success', hits: 1 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: CacheSetRequest = {
      prompt: 'What is Go?',
      response: 'A compiled language.',
      ttl: 3600,
    };

    const result = await ember.set(request);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/cache/set',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    );
  });

  it('should throw EmberError on set failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const request: CacheSetRequest = {
      prompt: 'What is Go?',
      response: 'A compiled language.',
    };

    await expect(ember.set(request)).rejects.toThrow(EmberError);
  });

  it('should successfully get from cache', async () => {
    const mockResponse = { response: 'A compiled language.', similarity: 1.0 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: CacheGetRequest = {
      prompt: 'Tell me about Go',
      similarity_threshold: 0.8,
    };

    const result = await ember.get(request);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/cache/get',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    );
  });

  it('should successfully get stats', async () => {
    const mockResponse = { total_items: 100 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await ember.stats();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/v1/stats');
  });
});
