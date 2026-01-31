import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getRandomPrompt } from './lib/data.js';

// Custom metrics
const cacheHitRate = new Rate('cache_hit_rate');
const latencyTrend = new Trend('latency');
const tokenSavings = new Counter('tokens_saved');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // 10 VU for 30s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate < 10%
    cache_hit_rate: ['rate>0.5'],     // Cache hit rate > 50%
  },
};

const BASE_URL = __ENV.CORE_URL || 'http://localhost:3000';

export default function () {
  const prompt = getRandomPrompt();
  
  const payload = JSON.stringify({
    prompt: prompt,
    model: 'llama3.2'
  });
  
  const response = http.post(`${BASE_URL}/v1/chat`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.json('response') !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Record metrics
  if (success) {
    const json = response.json();
    cacheHitRate.add(json.cached ? 1 : 0);
    latencyTrend.add(response.timings.duration);
    
    if (json.cached) {
      // Estimate 100 tokens saved per cache hit
      tokenSavings.add(100);
    }
  }
  
  sleep(1);
}
