import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Controller } from '../src/controller.js';
import { validateConfig } from '../src/config.js';

const quota = used => ({ rateLimits: { limitId: 'codex', primary: { usedPercent: used, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 10000 } } });
class FakeRpc extends EventEmitter {
  calls = []; auth = 'chatgpt'; used = 0;
  async initialize() { return { userAgent: 'fake' }; }
  async request(method, params) {
    this.calls.push({ method, params });
    if (method === 'account/read') return { account: { type: this.auth } };
    if (method === 'account/rateLimits/read') { if (this.outage) throw new Error('offline'); return quota(this.used); }
    if (method === 'thread/start') return { thread: { id: 'thread' }, model: 'fake' };
    if (method === 'thread/resume') return { thread: { id: 'thread', status: { type: this.resumeStatus || 'idle' }, turns: [] } };
    if (method === 'turn/steer') { if (this.steerError) throw this.steerError; return { turnId: params.expectedTurnId }; }
    if (method === 'turn/start') { this.emit('notification', { method: 'turn/started', params: { threadId: 'thread', turn: { id: 'turn' } } }); return { turn: { id: 'turn' } }; }
    return {};
  }
  reject() {} close() { this.closed = true; }
}
function create(config = {}) {
  const rpc = new FakeRpc(), events = [];
  const store = { id: 'run', save(s) { this.state = structuredClone(s); }, event(type, data) { events.push({ type, data }); }, checkpoint(cp, state) { state.checkpoint = cp; this.save(state); }, load() { return this.state; } };
  const c = new Controller({ cwd: process.cwd(), config: validateConfig(config), rpc, store });
  return { c, rpc, store, events };
}
test('preflight blocks critical quota and API billing before any model call', async () => {
  for (const kind of ['quota', 'auth']) {
    const { c, rpc } = create(); if (kind === 'quota') rpc.used = 95; else rpc.auth = 'apiKey';
    await assert.rejects(c.prepare({ goal: 'test' }));
    assert.equal(rpc.calls.some(x => ['thread/start', 'turn/start'].includes(x.method)), false); await c.close();
  }
});
test('initial warning queued until active turn, dedup, then critical escalation', async () => {
  const { c, rpc } = create(); rpc.used = 80; await c.prepare({ goal: 'test' });
  const running = c.run(); await new Promise(resolve => setImmediate(resolve)); await c.queue;
  assert.equal(rpc.calls.filter(x => x.method === 'turn/steer').length, 1);
  c.acceptLimits(quota(80)); await c.queue;
  assert.equal(rpc.calls.filter(x => x.method === 'turn/steer').length, 1);
  c.acceptLimits(quota(90)); await c.queue;
  assert.equal(rpc.calls.filter(x => x.method === 'turn/steer').length, 2);
  assert.equal(c.pauseRequested, true);
  rpc.emit('notification', { method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } } });
  assert.equal((await running).status, 'paused'); await c.close();
});
test('pause mode requests orderly pause already at warning', async () => {
  const { c, rpc } = create({ mode: 'pause' }); await c.prepare({ goal: 'test' });
  c.state.turnId = 'turn'; c.acceptLimits(quota(80)); await c.queue;
  assert.match(rpc.calls.at(-1).params.input[0].text, /Pause in an orderly way/); await c.close();
});
test('ambiguous steer result is journaled and never automatically retried', async () => {
  const { c, rpc, events } = create(); await c.prepare({ goal: 'test' }); c.state.turnId = 'turn';
  rpc.steerError = Object.assign(new Error('timeout'), { uncertain: true }); c.acceptLimits(quota(90)); await c.queue;
  assert.equal(c.state.warnings[0].status, 'delivery-outcome-unknown');
  c.acceptLimits(quota(90)); await c.queue; assert.equal(rpc.calls.filter(x => x.method === 'turn/steer').length, 1);
  assert.ok(events.find(x => x.type === 'steer-attempt')); await c.close();
});
test('poll outage becomes stale pause, and monitoring never creates model turns', async () => {
  const { c, rpc } = create(); await c.prepare({ goal: 'test' }); c.state.turnId = 'turn';
  c.now = () => Date.now() + 181000; rpc.outage = true; await c.poll(); await c.queue;
  assert.equal(c.pauseRequested, true); assert.equal(rpc.calls.some(x => x.method === 'turn/start'), false); await c.close();
});
test('disconnect preserves incomplete tool outcome and stops unmanaged execution', async () => {
  const { c, rpc, store } = create(); await c.prepare({ goal: 'test' });
  c.onNotification({ method: 'item/started', params: { threadId: 'thread', item: { type: 'commandExecution', id: 'cmd', command: 'example' } } });
  rpc.emit('disconnect', new Error('lost connection'));
  assert.equal(store.state.tools.cmd.status, 'outcome-unknown'); assert.equal(store.state.status, 'needs-attention'); assert.equal(rpc.closed, true);
});
test('failed turn is not reported complete; cross-thread events ignored', async () => {
  const { c, rpc } = create(); await c.prepare({ goal: 'test' });
  c.onNotification({ method: 'turn/completed', params: { threadId: 'other', turn: { status: 'completed' } } }); assert.equal(c.finished, undefined);
  const running = c.run(); await new Promise(resolve => setImmediate(resolve));
  c.onNotification({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'failed', error: { message: 'quota reached' } } } });
  const state = await running; assert.equal(state.status, 'failed'); assert.equal(state.error, 'quota reached'); await c.close();
});
test('parallel quota consumption during setup blocks turn/start', async () => {
  const { c, rpc } = create(); await c.prepare({ goal: 'test' }); rpc.used = 99;
  await assert.rejects(c.run(), /before turn start/);
  assert.equal(rpc.calls.some(x => x.method === 'turn/start'), false); await c.close();
});
test('recovery before active turn removes obsolete pending warnings', async () => {
  const { c, rpc } = create(); rpc.used = 80; await c.prepare({ goal: 'test' });
  assert.equal(c.state.pendingWarnings.length, 1); c.acceptLimits(quota(0), true); assert.equal(c.state.pendingWarnings.length, 0); await c.close();
});
test('checkpoint disk failure stops execution, rather than classifying it as bad model JSON', async () => {
  const { c, rpc, store } = create(); await c.prepare({ goal: 'test' });
  store.checkpoint = () => { throw new Error('disk full'); };
  rpc.emit('notification', { method: 'item/completed', params: { threadId: 'thread', item: { type: 'agentMessage', id: 'msg', text: '<soft-landing-checkpoint>{"goal":"test","completed":[],"files":[],"tests":[],"open":[],"uncertain":[],"nextStep":"verify"}</soft-landing-checkpoint>' } } });
  assert.equal(c.state.status, 'needs-attention'); assert.equal(rpc.closed, true);
});
test('grace deadline interrupts a still-running turn without another model call', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { c, rpc } = create({ graceSeconds: 10 }); await c.prepare({ goal: 'test' }); c.state.turnId = 'turn';
  c.acceptLimits(quota(95)); await c.queue;
  t.mock.timers.tick(10000); await Promise.resolve();
  assert.ok(rpc.calls.some(x => x.method === 'turn/interrupt'));
  assert.equal(rpc.calls.some(x => x.method === 'turn/start'), false); await c.close();
});
test('resume inspects state, carries uncertain tools and waits for explicit run', async () => {
  const { c, store } = create(); await c.prepare({ goal: 'original objective' });
  c.state.tools.cmd = { status: 'outcome-unknown', command: 'side effect' }; c.state.status = 'paused'; c.persist(); await c.close();
  const rpc = new FakeRpc(), resumed = new Controller({ cwd: process.cwd(), config: validateConfig(), rpc, store });
  await resumed.prepare({ resume: true });
  assert.ok(resumed.state.resumeInspection.at); assert.equal(rpc.calls.some(x => x.method === 'turn/start'), false);
  const run = resumed.run({ resumePrompt: '' }); await new Promise(resolve => setImmediate(resolve));
  const input = rpc.calls.find(x => x.method === 'turn/start').params.input[0].text;
  assert.match(input, /original objective/); assert.match(input, /outcome-unknown/); assert.match(input, /First verify the actual state/);
  rpc.emit('notification', { method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } } }); await run; await resumed.close();
});
test('active saved thread cannot be resumed into another turn', async () => {
  const { c, store } = create(); await c.prepare({ goal: 'test' }); await c.close();
  const rpc = new FakeRpc(); rpc.resumeStatus = 'active';
  const resumed = new Controller({ cwd: process.cwd(), config: validateConfig(), rpc, store });
  await assert.rejects(resumed.prepare({ resume: true }), /still active/); assert.equal(rpc.calls.some(x => x.method === 'turn/start'), false); await resumed.close();
});
test('a run blocked before thread creation can be resumed after quota recovery', async () => {
  const { c, rpc, store } = create(); rpc.used = 99; await assert.rejects(c.prepare({ goal: 'test' })); await c.close();
  const nextRpc = new FakeRpc(), resumed = new Controller({ cwd: process.cwd(), config: validateConfig(), rpc: nextRpc, store });
  await resumed.prepare({ resume: true }); assert.equal(resumed.state.threadId, 'thread'); assert.equal(resumed.state.goal, 'test'); await resumed.close();
});
