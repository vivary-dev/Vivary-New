import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OWNER = 'owner@local.vivary.test';
const PROXY_ORIGIN = 'https://vivary.example.test';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

// fetch() cannot set Host, which the private proxy boundary reads.
function send(port, method, route, headers, body) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path: route, method, headers }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: text }));
    });
    request.setTimeout(15_000, () => request.destroy(new Error(`${method} ${route} timed out`)));
    request.on('error', reject);
    request.end(body);
  });
}

const get = (port, route, headers) => send(port, 'GET', route, headers);

// Native's MCP dev-open mode trusted a loopback caller that names the owner, with no session.
async function mcpInitialize(port, route, headers) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw-local-program', version: '0' } },
  });
  return send(port, 'POST', route, {
    ...headers,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'x-agent-native-owner-email': OWNER,
  }, body);
}

const modes = {
  local: {
    args: [],
    env: {},
    origin: port => `http://127.0.0.1:${port}`,
    headers: port => ({ host: `127.0.0.1:${port}` }),
    carry: signedIn => ({ cookie: signedIn.cookie }),
  },
  // The Zo private proxy drops the Cookie header, so the browser carries its
  // session token in X-Vivary-Session on same-origin reads.
  'private-proxy': {
    args: ['--private-proxy', '--url', PROXY_ORIGIN],
    env: { VIVARY_TRUSTED_PROXY: 'zo-owner-only' },
    origin: () => PROXY_ORIGIN,
    carry: signedIn => ({ 'x-vivary-session': signedIn.body.token, 'sec-fetch-site': 'same-origin' }),
    headers: port => ({
      host: `127.0.0.1:${port}`,
      'x-forwarded-host': new URL(PROXY_ORIGIN).host,
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
      'x-forwarded-for': '192.0.2.10',
      'x-real-ip': '192.0.2.10',
    }),
  },
};

async function start(mode, data) {
  const port = await freePort();
  const child = spawn(process.execPath, ['bin/start.mjs', '--port', String(port), '--data-dir', data, ...mode.args], {
    cwd: root,
    detached: true,
    env: { PATH: '/usr/bin:/bin', HOME: data, ...mode.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
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
      if ((await get(port, '/_agent-native/ping', mode.headers(port))).status === 200) break;
    } catch { /* The server may still be booting. */ }
    if (Date.now() > deadline) { await stop(); throw new Error(`Vivary readiness timed out:\n${output}`); }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { port, stop, output: () => output };
}

async function savedSecret(file, origin) {
  const address = new URL((await readFile(file, 'utf8')).trim());
  assert.equal(address.origin, origin);
  assert.equal(address.pathname, '/sign-in');
  assert.equal(address.search, '');
  const secret = address.hash.slice(1);
  assert.match(secret, /^[\w-]{43}$/);
  return secret;
}

function cookies(response) {
  return [response.headers['set-cookie'] ?? []].flat().map(value => value.split(';')[0]).join('; ');
}

async function session(server, mode, extra = {}) {
  const response = await get(server.port, '/_agent-native/auth/session', { ...mode.headers(server.port), ...extra });
  assert.equal(response.status, 200, response.body);
  return { body: JSON.parse(response.body), cookie: cookies(response) };
}

for (const [name, mode] of Object.entries(modes)) {
  test(`${name} mode mints an owner session only for the one-time sign-in address`, { timeout: 180_000 }, async t => {
    const data = await mkdtemp(path.join(tmpdir(), `vivary-owner-sign-in-${name}-`));
    const file = path.join(data, 'owner-sign-in.txt');
    let server = await start(mode, data);
    t.after(async () => { await server.stop(); await rm(data, { recursive: true, force: true }); });
    const origin = mode.origin(server.port);
    const secrets = [];

    secrets.push(await savedSecret(file, origin));
    if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);

    const anonymous = await session(server, mode);
    assert.equal(anonymous.body.email, undefined, 'a request without the secret gets no session');
    assert.equal(anonymous.cookie, '');
    const raw = { host: `127.0.0.1:${server.port}`, 'content-type': 'application/json' };
    for (const route of ['/mcp', '/_agent-native/mcp']) {
      const mcp = await mcpInitialize(server.port, route, { host: raw.host });
      assert.notEqual(mcp.status, 200, `${route} must not admit a raw local program that names the owner`);
      const device = await send(server.port, 'POST', `${route}/connect/device/start`, raw, '{}');
      assert.doesNotMatch(device.body, /device_code|user_code/, `${route} must not start an MCP connect flow`);
      const client = await send(server.port, 'POST', `${route}/oauth/register`, raw,
        JSON.stringify({ client_name: 'raw-local-program', redirect_uris: ['http://127.0.0.1:9/callback'] }));
      assert.doesNotMatch(client.body, /client_id/, `${route} must not register an MCP OAuth client`);
    }

    const signedIn = await session(server, mode, { 'x-vivary-owner-sign-in': secrets[0] });
    assert.equal(signedIn.body.email, OWNER);
    assert.notEqual(signedIn.cookie, '');
    secrets.push(await savedSecret(file, origin));
    assert.notEqual(secrets[1], secrets[0], 'a used address is replaced');

    const replay = await session(server, mode, { 'x-vivary-owner-sign-in': secrets[0] });
    assert.equal(replay.body.email, undefined, 'a used address cannot sign in again');
    assert.equal(replay.cookie, '');

    assert.equal((await session(server, mode, mode.carry(signedIn))).body.email, OWNER);
    const headerOnly = { 'x-vivary-session': signedIn.body.token, 'sec-fetch-site': 'same-origin' };
    assert.equal((await session(server, mode, headerOnly)).body.email, name === 'local' ? undefined : OWNER,
      'only the private proxy accepts the session header on reads');

    const servers = await get(server.port, '/_agent-native/mcp/servers', { ...mode.headers(server.port), ...mode.carry(signedIn) });
    assert.equal(servers.status, 200, 'the MCP client settings route still answers the owner');

    const page = await get(server.port, '/sign-in', mode.headers(server.port));
    assert.equal(page.status, 200);
    const scriptStart = page.body.indexOf('<script');
    const firstScript = page.body.slice(scriptStart, page.body.indexOf('</script>', scriptStart));
    assert.match(firstScript, /x-vivary-owner-sign-in/, 'the sign-in script runs before any script Native adds');

    await server.stop();
    const firstOutput = server.output();
    server = await start(mode, data);
    const restartedOrigin = mode.origin(server.port);
    secrets.push(await savedSecret(file, restartedOrigin));
    assert.notEqual(secrets[2], secrets[1], 'each launch saves a new address');
    assert.equal((await session(server, mode, { 'x-vivary-owner-sign-in': secrets[1] })).body.email, undefined);
    assert.equal((await session(server, mode, mode.carry(signedIn))).body.email, OWNER,
      'an existing owner session survives a restart');

    await server.stop();
    const output = firstOutput + server.output();
    assert.match(output, /owner-sign-in\.txt/);
    for (const secret of secrets) assert.ok(!output.includes(secret), 'the secret never reaches the console');
  });
}
