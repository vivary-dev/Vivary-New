import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const HOSTED_ORIGIN = 'https://hosted.vivary.example.test';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function send(port, method, route, headers, body) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path: route, method, headers }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: text }));
    });
    request.setTimeout(15_000, () => request.destroy(new Error(`${method} ${route} timed out`)));
    request.on('error', reject);
    request.end(body);
  });
}

// Native's MCP dev-open mode trusted a loopback caller that names an owner, with no session.
function mcpInitialize(port, route) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw-local-program', version: '0' } },
  });
  return send(port, 'POST', route, {
    host: `127.0.0.1:${port}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'x-agent-native-owner-email': 'owner@hosted.vivary.example.test',
  }, body);
}

async function startHosted(data) {
  const port = await freePort();
  const child = spawn(process.execPath,
    ['bin/start.mjs', '--hosted', '--url', HOSTED_ORIGIN, '--port', String(port), '--data-dir', data], {
      cwd: root,
      detached: true,
      env: { PATH: '/usr/bin:/bin', HOME: data },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => process.kill(-child.pid, 'SIGKILL'), 10_000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      process.kill(-child.pid, 'SIGTERM');
    });
  };
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Vivary exited before readiness:\n${output}`);
    try {
      if ((await send(port, 'GET', '/_agent-native/ping', { host: `127.0.0.1:${port}` })).status === 200) break;
    } catch { /* The server may still be booting. */ }
    if (Date.now() > deadline) { await stop(); throw new Error(`Vivary readiness timed out:\n${output}`); }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { port, stop };
}

test('a hosted launch serves no MCP endpoint and no MCP connect or OAuth routes', { timeout: 180_000 }, async t => {
  const data = await mkdtemp(path.join(tmpdir(), 'vivary-hosted-mcp-'));
  const server = await startHosted(data);
  t.after(async () => { await server.stop(); await rm(data, { recursive: true, force: true }); });
  const raw = { host: `127.0.0.1:${server.port}`, 'content-type': 'application/json' };

  for (const route of ['/mcp', '/_agent-native/mcp']) {
    const mcp = await mcpInitialize(server.port, route);
    assert.equal(mcp.status, 404, `${route} is unmounted in a hosted launch, got ${mcp.status}`);
    const device = await send(server.port, 'POST', `${route}/connect/device/start`, raw, '{}');
    assert.ok([401, 404].includes(device.status), `${route} connect is unmounted, got ${device.status}`);
    assert.doesNotMatch(device.body, /device_code|user_code/, `${route} must not start an MCP connect flow`);
    const client = await send(server.port, 'POST', `${route}/oauth/register`, raw,
      JSON.stringify({ client_name: 'raw-local-program', redirect_uris: ['http://127.0.0.1:9/callback'] }));
    assert.ok([401, 404].includes(client.status), `${route} OAuth is unmounted, got ${client.status}`);
    assert.doesNotMatch(client.body, /client_id/, `${route} must not register an MCP OAuth client`);
  }
});
