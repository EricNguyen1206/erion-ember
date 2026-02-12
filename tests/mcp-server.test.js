import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'src', 'mcp-server.js');

describe('MCP Server', () => {
  let serverProcess;
  let messageId = 0;

  beforeAll(() => {
    serverProcess = spawn('bun', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      let response = '';
      
      const onData = (data) => {
        response += data.toString();
        const lines = response.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.id === id) {
                serverProcess.stdout.off('data', onData);
                resolve(parsed);
                return;
              }
            } catch (e) {
              // Not valid JSON yet, continue reading
            }
          }
        }
      };

      serverProcess.stdout.on('data', onData);
      serverProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        serverProcess.stdout.off('data', onData);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  test('should handle initialize request', async () => {
    const result = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    expect(result.error).toBeUndefined();
    expect(result.result).toBeDefined();
    expect(result.result.protocolVersion).toBe('2024-11-05');
  });

  test('should list available tools', async () => {
    const result = await sendRequest('tools/list', {});

    expect(result.error).toBeUndefined();
    expect(result.result).toBeDefined();
    expect(result.result.tools).toBeDefined();
    expect(result.result.tools.length).toBeGreaterThan(0);
  });
});
