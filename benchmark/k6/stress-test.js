import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getRandomPrompt } from './lib/data.js';

const cacheHitRate = new Rate('cache_hit_rate');
const latencyTrend = new Trend('latency');
const tokenSavings = new Counter('tokens_saved');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 VU
    { duration: '3m', target: 200 },   // Ramp up to 200 VU
    { duration: '3m', target: 400 },   // Ramp up to 400 VU
    { duration: '3m', target: 500 },   // Ramp up to 500 VU
    { duration: '2m', target: 500 },   // Stay at 500 VU
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
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
  
  sleep(Math.random() * 3 + 1); // Random sleep 1-4s
}
