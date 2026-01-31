import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getRandomPrompt } from './lib/data.js';

const cacheHitRate = new Rate('cache_hit_rate');
const latencyTrend = new Trend('latency');
const tokenSavings = new Counter('tokens_saved');

export const options = {
  stages: [
    { duration: '10m', target: 50 },  // Ramp up to 50 VU
    { duration: '50m', target: 50 },  // Stay at 50 VU for 50 min
    { duration: '10m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
    cache_hit_rate: ['rate>0.7'],
  },
};

const BASE_URL = __ENV.CORE_URL || 'http://localhost:3000';

export default function () {
  const prompt = getRandomPrompt();
  
  const response = http.post(`${BASE_URL}/v1/chat`, JSON.stringify({
    prompt: prompt,
    model: 'llama3.2'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.json('response') !== undefined,
  });
  
  const json = response.json();
  cacheHitRate.add(json.cached ? 1 : 0);
  latencyTrend.add(response.timings.duration);
  
  if (json.cached) {
    tokenSavings.add(100);
  }
  
  sleep(Math.random() * 4 + 2); // Random sleep 2-6s
}
