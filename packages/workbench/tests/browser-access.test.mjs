import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'vivary-pairing-'));
Object.assign(process.env, { APP_NAME: 'VivaryPairingTest', DATABASE_URL: `file:${directory}/test.sqlite`, DATABASE_URL_UNPOOLED: `file:${directory}/test.sqlite` });
const { withMigrationRuntime, getDbExec, closeDbExec } = await import('@agent-native/core/db');
const { createBrowserAccess } = await import('../server/browser-access.mjs');
const { deviceResponse, createBrowserIngress, createBrowserListener } = await import('../server/browser-ingress.mjs');

test('pairing lifecycle survives restart and fails closed under partial writes', async t => {
  t.after(async () => { await closeDbExec(); await rm(directory, { recursive: true, force: true }); });
  const native = new Map(); let cleanupFails = false; let createFails = false; let failRevoke = false; let clock = Date.now();
  let lookupPause = null; let createPause = null; let queryPause = null;
  const sessions = {
    async addSession(token, email) { if (createPause) { const pause = createPause; createPause = null; pause.entered.resolve(); await pause.resume.promise; } native.set(token, email); if (createFails) throw new Error('Simulated uncertain Native write'); },
    async getSessionEmail(token) { if (lookupPause) { const pause = lookupPause; lookupPause = null; pause.entered.resolve(); await pause.resume.promise; } return native.get(token) ?? null; },
    async removeSession(token) { if (cleanupFails) throw new Error('Simulated cleanup failure'); native.delete(token); },
  };
  const realDatabase = getDbExec();
  const database = { async execute(query) { if (queryPause && query.sql.startsWith(queryPause.prefix)) { const pause = queryPause; queryPause = null; pause.entered.resolve(); await pause.resume.promise; } if (failRevoke && query.sql.startsWith("UPDATE vivary_browser_grants SET status='revoked'")) throw new Error('Simulated disk failure'); return realDatabase.execute(query); } };
  const open = () => withMigrationRuntime(() => createBrowserAccess({ database, sessions, now: () => clock }));
  let owner = await open();
  assert.equal(owner.configuration().enabled, false);
  assert.throws(() => owner.requestPairing('Phone'), /disabled/);
  await owner.configure({ origin: 'https://fixture.vivary.test', port: 42202, label: 'Laptop' });
  const pair = async label => { const request = owner.requestPairing(label); await owner.approve(request.id); return { request, result: await owner.completePairing(request.credential) }; };
  const first = await pair('Phone'); const second = await pair('Tablet');
  await assert.rejects(owner.completePairing(first.request.credential), /expired/);
  const pending = owner.requestPairing('Unfinished'); const identity = owner.configuration().instanceId;
  owner.close(); owner = await open();
  assert.equal(owner.configuration().instanceId, identity); assert.equal(owner.configuration().enabled, true);
  await assert.rejects(owner.completePairing(pending.credential), /expired/);
  const controller = new AbortController(); const admission = await owner.admit(first.result.credential, controller);
  assert.ok(admission);
  const held = new ReadableStream({ start(stream) { stream.enqueue(new TextEncoder().encode('event: ready\n\n')); } });
  const response = deviceResponse(new Response(held), controller, admission.release);
  const reader = response.body.getReader(); assert.ok((await reader.read()).value.length);
  const waiting = reader.read(); cleanupFails = true;
  await owner.revoke(admission.id);
  await assert.rejects(waiting, /access ended/);
  assert.equal(await owner.admit(first.result.credential, new AbortController()), null);
  const tablet = await owner.admit(second.result.credential, new AbortController()); assert.ok(tablet); tablet.release();
  owner.close(); cleanupFails = false; owner = await open();
  assert.equal(await owner.admit(first.result.credential, new AbortController()), null);
  const surviving = await owner.admit(second.result.credential, new AbortController()); assert.ok(surviving); surviving.release();
  createFails = true; const uncertain = owner.requestPairing('Uncertain'); await owner.approve(uncertain.id);
  await assert.rejects(owner.completePairing(uncertain.credential), /could not finish/);
  await assert.rejects(owner.completePairing(uncertain.credential), /expired/); createFails = false;
  const expired = owner.requestPairing('Expired'); clock += 300001;
  await assert.rejects(owner.approve(expired.id), /expired/);
  for (let i = 0; i < 10; i++) owner.requestPairing('Limited');
  assert.throws(() => owner.requestPairing('Excess'), /Too many/);
  failRevoke = true;
  await assert.rejects(owner.revoke(surviving.id), /not saved/);
  assert.equal(owner.configuration().enabled, false);
  assert.equal(await owner.admit(second.result.credential, new AbortController()), null);
  failRevoke = false; await owner.revoke(surviving.id);
  await owner.disable(); owner.close(); owner = await open();
  assert.equal(owner.configuration().enabled, false);
  owner.close();
  const pause = () => ({ entered: Promise.withResolvers(), resume: Promise.withResolvers() });
  await t.test('close while Native identity lookup is pending refuses admission', async () => {
    owner = await open(); await owner.configure({ origin: 'https://fixture.vivary.test', port: 42202, label: 'Laptop' });
    const paired = await pair('Closing');
    const gate = pause(); lookupPause = gate;
    const admission = owner.admit(paired.result.credential, new AbortController());
    await gate.entered.promise; owner.close(); gate.resume.resolve(); assert.equal(await admission, null);
  });
  for (const phase of ['insert', 'native', 'activate']) await t.test(`close during pairing ${phase} cannot activate a partial grant`, async () => {
    owner = await open(); const request = owner.requestPairing('Interrupted'); await owner.approve(request.id);
    const gate = pause();
    if (phase === 'native') createPause = gate;
    else queryPause = { ...gate, prefix: phase === 'insert' ? 'INSERT INTO vivary_browser_grants' : "UPDATE vivary_browser_grants SET status='active'" };
    const completion = owner.completePairing(request.credential);
    await gate.entered.promise; owner.close(); gate.resume.resolve(); await assert.rejects(completion, /could not finish/);
    const rows = await realDatabase.execute({ sql: "SELECT status FROM vivary_browser_grants WHERE label='Interrupted'", args: [] });
    assert.equal(rows.rows.some(row => row.status === 'active'), false);
  });
  await t.test('old response cleanup cannot erase a newly admitted stream', async () => {
    owner = await open(); const paired = await pair('Re-enabled');
    const old = await owner.admit(paired.result.credential, new AbortController());
    await owner.disable(); await owner.configure({ origin: 'https://fixture.vivary.test', port: 42202, label: 'Laptop' });
    const currentController = new AbortController(); const current = await owner.admit(paired.result.credential, currentController);
    old.release(); await owner.revoke(current.id); assert.equal(currentController.signal.aborted, true); current.release(); owner.close();
  });
  await t.test('grant expiry closes an existing stream', async () => {
    owner = await open(); const paired = await pair('Expiring');
    await realDatabase.execute({ sql: "UPDATE vivary_browser_grants SET expires_at=? WHERE label='Expiring'", args: [clock + 20] });
    const controller = new AbortController(); const admission = await owner.admit(paired.result.credential, controller);
    clock += 21; await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(controller.signal.aborted, true); admission.release(); owner.close();
  });
});

test('remote admission blocks alternate routes and cleans every response or failure', async () => {
  let dispatches = 0; let released = 0; let admitFailure = false; let dispatchFailure = false;
  const access = { configuration: () => ({ enabled: true, origin: 'https://fixture.vivary.test' }),
    async admit() { if (admitFailure) throw new Error('Lookup failed'); return { id: 'fixture', release() { released++; } }; } };
  const ingress = createBrowserIngress({ access, capability: 'fixture', localOrigin: 'http://127.0.0.1:1',
    dispatch: async () => { dispatches++; if (dispatchFailure) throw new Error('Dispatch failed'); return new Response(null, { status: 204, headers: { 'set-cookie': 'an_session=fixture' } }); } });
  const request = path => new Request('https://fixture.vivary.test' + path, { headers: { host: 'fixture.vivary.test' } });
  for (const route of ['/mcp/connect/token', '/mcp/device/authorize', '/%6dcp/connect/token', '/_agent-native/%61uth/login',
    '/_agent-native/actions/vivary-connect-project-%66older', '/_agent-native/auth/session?__an_embed_token=fixture', '/_agent-native/%ZZ']) {
    assert.equal((await ingress.remote(request(route))).status, 401, route);
  }
  assert.equal(dispatches, 0);
  const allowed = await ingress.remote(request('/_agent-native/auth/session'));
  assert.equal(allowed.status, 204); assert.equal(allowed.headers.get('set-cookie'), null); assert.equal(allowed.headers.get('cache-control'), 'no-store'); assert.equal(released, 1);
  dispatchFailure = true; assert.equal((await ingress.remote(request('/'))).status, 409); assert.equal(released, 2);
  admitFailure = true;
  const broken = request('/'); let listeners = 0;
  const add = broken.signal.addEventListener.bind(broken.signal), remove = broken.signal.removeEventListener.bind(broken.signal);
  broken.signal.addEventListener = (...args) => { listeners++; return add(...args); };
  broken.signal.removeEventListener = (...args) => { listeners--; return remove(...args); };
  assert.equal((await ingress.remote(broken)).status, 409); assert.equal(listeners, 0);
});

test('listener shutdown owns a server whose listen callback is still pending', async () => {
  const { EventEmitter } = await import('node:events');
  const starting = Promise.withResolvers(); let completeListen; let closed = false;
  const server = new EventEmitter(); server.closeAllConnections = () => undefined;
  server.close = callback => { closed = true; callback(); };
  server.listen = (_port, host, callback) => { assert.equal(host, '127.0.0.1'); completeListen = callback; starting.resolve(); };
  const listener = createBrowserListener({ access: { configuration: () => ({ enabled: true, port: 42300 }) }, fetch: () => new Response(''), createHttpServer: () => server });
  const opening = listener.reconcile(); await starting.promise; const closing = listener.close();
  completeListen(); await opening; await closing; assert.equal(closed, true);
});


test('external top-level entry serves only public bootstrap before any device access', async () => {
  let enabled = true;
  const calls = [];
  const access = {
    configuration: () => ({ enabled, origin: 'https://fixture.vivary.test', label: 'Private host identity' }),
    async admit() { calls.push('admit'); return { id: 'valid-device', release() {} }; },
    requestPairing() { calls.push('pair'); throw new Error('Unexpected pairing'); },
  };
  const ingress = createBrowserIngress({ access, capability: 'fixture', localOrigin: 'http://127.0.0.1:1',
    dispatch: async () => { calls.push('dispatch'); return new Response('Native'); } });
  const headers = { host: 'fixture.vivary.test', cookie: '__Host-vivary-device=' + 'a'.repeat(43), 'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', accept: 'text/html,application/xhtml+xml' };
  const request = (route, extra = {}, method = 'GET') => new Request('https://fixture.vivary.test' + route,
    { method, headers: { ...headers, ...extra } });
  let bootstrap;
  for (const route of ['/', '/pair']) for (const cookie of ['', '__Host-vivary-device=' + 'a'.repeat(43)]) {
    const response = await ingress.remote(request(route, { cookie }));
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('set-cookie'), null);
    const body = await response.text();
    assert.equal(body.includes('Private host identity'), false);
    bootstrap ??= body; assert.equal(body, bootstrap);
  }
  const refused = [
    ['/_vivary/browser/status'], ['/_vivary/browser/pair', {}, 'POST'],
    ['/_vivary/browser/complete', {}, 'POST'], ['/_agent-native/auth/session'], ['/settings'],
    ['/', {}, 'POST'], ['/', {}, 'HEAD'], ['/', { 'sec-fetch-mode': 'cors' }],
    ['/', { 'sec-fetch-mode': '' }], ['/', { 'sec-fetch-dest': 'iframe' }],
    ['/', { 'sec-fetch-dest': 'empty' }], ['/', { accept: 'application/json' }],
    ['/', { host: 'localhost' }], ['/', { authorization: 'Bearer alternate' }],
    ['/', { 'x-vivary-session': 'alternate' }], ['/', { 'x-vivary-desktop': 'alternate' }],
    ['/?_session=alternate'], ['/?__an_embed_token=alternate'], ['/%70air'],
    ['/%6dcp/connect/token'], ['/_agent-native/%61uth/login'], ['/%ZZ'],
  ];
  for (const [route, extra, method] of refused) assert.equal((await ingress.remote(request(route, extra, method))).status, 401, route);
  enabled = false;
  for (const route of ['/', '/pair']) assert.equal((await ingress.remote(request(route))).status, 401);
  assert.deepEqual(calls, []);
});
