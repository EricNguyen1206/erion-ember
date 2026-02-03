import { describe, test, expect } from 'bun:test';
import { spawn } from 'bun';

const waitPort = async (port) => {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Server did not start on port ${port}`);
};

describe('Security Middleware', () => {
  test('Server starts without API_KEY (Fail Open)', async () => {
    const port = 3001;
    const env = { ...process.env, PORT: port.toString() };
    delete env.API_KEY; // Ensure API_KEY is unset

    const proc = spawn(['bun', 'src/server.js'], {
      env,
      stdout: 'ignore',
      stderr: 'inherit'
    });

    try {
      await waitPort(port);

      // Check /health
      const health = await fetch(`http://localhost:${port}/health`);
      expect(health.status).toBe(200);

      // Check /v1/chat (should be open)
      const chat = await fetch(`http://localhost:${port}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      });
      expect(chat.status).toBe(200);

    } finally {
      proc.kill();
    }
  });

  test('Server requires API_KEY when set', async () => {
    const port = 3002;
    const API_KEY = 'secret-key-123';
    const env = { ...process.env, PORT: port.toString(), API_KEY };

    const proc = spawn(['bun', 'src/server.js'], {
      env,
      stdout: 'ignore',
      stderr: 'inherit'
    });

    try {
      await waitPort(port);

      // Check /health (always open)
      const health = await fetch(`http://localhost:${port}/health`);
      expect(health.status).toBe(200);

      // Check /v1/chat without key
      const noKey = await fetch(`http://localhost:${port}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      });
      expect(noKey.status).toBe(401);

      // Check /v1/chat with wrong key
      const wrongKey = await fetch(`http://localhost:${port}/v1/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'wrong-key'
        },
        body: JSON.stringify({ prompt: 'hello' })
      });
      expect(wrongKey.status).toBe(401);

      // Check /v1/chat with correct key
      const correctKey = await fetch(`http://localhost:${port}/v1/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ prompt: 'hello' })
      });
      expect(correctKey.status).toBe(200);

    } finally {
      proc.kill();
    }
  });
});
