import test from 'node:test';
import assert from 'node:assert/strict';
import { AppServer } from '../src/rpc.js';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('./fixtures/rpc-server.js', import.meta.url));
const make = (timeoutMs = 2000) => new AppServer({ executable: process.execPath, args: [fixture], timeoutMs });

test('RPC handshake, concurrent IDs, notifications, malformed lines and child lifecycle', async () => {
  const rpc = make();
  try {
    assert.deepEqual(await rpc.initialize(), { test: true });
    const notices = [], diagnostics = []; rpc.on('notification', x => notices.push(x)); rpc.on('diagnostic', x => diagnostics.push(x));
    const [slow, fast] = await Promise.all([rpc.request('echo', { value: 1, delay: 30 }), rpc.request('echo', { value: 2 })]);
    assert.equal(slow.value, 1); assert.equal(fast.value, 2);
    await rpc.request('notify'); assert.equal(notices[0].method, 'sample'); assert.equal(diagnostics.length, 1);
  } finally { await rpc.close(); }
  assert.ok(rpc.child.exitCode !== null || rpc.child.signalCode !== null);
});
test('RPC timeout has uncertain outcome and does not resend; disconnect rejects pending work', async () => {
  const rpc = make(200);
  try {
    await rpc.initialize();
    await assert.rejects(rpc.request('no-reply'), error => error.uncertain === true);
    assert.equal(rpc.pending.size, 0);
    await assert.rejects(rpc.request('exit'), /disconnected/);
  } finally { await rpc.close(); }
});
test('model API keys are not inherited by the spawned server', async () => {
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-value';
  const rpc = make();
  try { await rpc.initialize(); assert.deepEqual(await rpc.request('env'), { openai: false, codex: false }); }
  finally { await rpc.close(); if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old; }
});
test('missing executable reports startup error without hanging', async () => {
  const rpc = new AppServer({ executable: 'soft-landing-does-not-exist-72391', timeoutMs: 500 });
  await assert.rejects(rpc.initialize(), /ENOENT/); await rpc.close();
});
