import test from 'node:test';
import assert from 'node:assert/strict';
import { LimitMonitor } from '../src/limits.js';
import { validateConfig } from '../src/config.js';

const now = 1000000, reset = 5000;
const window = (usedPercent, resetsAt = reset) => ({ usedPercent, resetsAt, windowDurationMins: 300 });
const payload = (primary = 0, secondary = 0, resetsAt = reset) => ({ rateLimits: { limitId: 'codex', primary: window(primary, resetsAt), secondary: window(secondary, resetsAt + 10000) } });
const make = (config = {}) => new LimitMonitor(validateConfig(config));

test('inclusive warning/handoff, duplicates deduplicated, escalation delivered', () => {
  const m = make();
  assert.equal(m.ingest(payload(79), now, true).actions.length, 0);
  assert.equal(m.ingest(payload(80), now).actions[0].severity, 'warning');
  assert.equal(m.ingest(payload(80), now).actions.length, 0);
  assert.equal(m.ingest(payload(90), now).actions[0].severity, 'handoff');
  assert.equal(m.ingest(payload(95), now).actions.length, 0);
});
test('multiple windows and buckets: restrictive relevant window wins; legacy is ignored', () => {
  const m = make({ limitIds: ['codex', 'special'] });
  const r = m.ingest({ ...payload(100), rateLimitsByLimitId: { codex: { primary: window(5), secondary: window(91) }, special: { primary: window(82) } } }, now, true);
  assert.equal(r.windows.length, 3); assert.equal(r.canStart, false);
  assert.deepEqual(r.actions.map(a => a.key), ['codex/secondary', 'special/primary']);
});
test('read reset expiry never implies renewed quota; confirmed reset rearms warnings', () => {
  const m = make(); m.ingest(payload(90), now, true);
  assert.equal(m.evaluate(reset * 1000).canStart, false);
  const r = m.ingest(payload(80, 0, reset + 20000), reset * 1000, true);
  assert.equal(r.actions[0].severity, 'warning'); assert.equal(r.health, 'fresh');
});
test('sparse metadata does not refresh window TTL or clear spend block', () => {
  const m = make(); m.ingest({ rateLimits: { ...payload(10).rateLimits, spendControlReached: true } }, now, true);
  assert.equal(m.ingest({ rateLimits: { limitId: 'codex', primary: null, spendControlReached: null } }, now + 1000).health, 'blocked');
  assert.equal(m.evaluate(now + 181000).health, 'unknown');
});
test('partial primary event does not freshen old secondary', () => {
  const m = make(); m.ingest(payload(10, 10), now, true);
  const r = m.ingest({ rateLimits: { limitId: 'codex', primary: window(11) } }, now + 181000);
  assert.equal(r.health, 'unknown'); assert.equal(r.windows.length, 1);
});
test('unknown, malformed and missing known windows fail closed', () => {
  const m = make(); assert.equal(m.ingest({}, now, true).canStart, false);
  assert.equal(m.ingest(payload(NaN), now, true).canStart, false);
  m.ingest(payload(0, 0), now, true);
  assert.equal(m.ingest({ rateLimits: { limitId: 'codex', primary: window(0), secondary: null } }, now, true).canStart, false);
});
test('duplicate missing data warnings suppressed until recovery and another outage', () => {
  const m = make(); assert.equal(m.evaluate(now).actions.length, 1); assert.equal(m.evaluate(now + 1).actions.length, 0);
  m.ingest(payload(), now, true); assert.equal(m.evaluate(now + 181000).actions.length, 1);
});
test('reordered events cannot decrease use within an epoch or revert a reset', () => {
  const m = make(); m.ingest(payload(90), now, true);
  assert.equal(m.ingest(payload(10), now + 10).windows[0].remaining, 10);
  m.ingest(payload(5, 0, reset + 20000), now + 20);
  assert.equal(m.ingest(payload(99), now + 30).windows[0].remaining, 95);
});
test('recovery hysteresis and persisted dedup', () => {
  const m = make(); m.ingest(payload(80), now, true);
  const n = new LimitMonitor(validateConfig(), m.saved());
  assert.equal(n.ingest(payload(81), now + 1, true).actions.length, 0);
  n.ingest(payload(77), now + 2, true);
  assert.equal(n.ingest(payload(80), now + 3, true).actions.length, 1);
});
test('missing reset time displayed as unknown, zero actual usage is valid', () => {
  const m = make(); const r = m.ingest({ rateLimits: { primary: window(0, null), limitId: 'codex' } }, now, true);
  assert.equal(r.canStart, true); assert.equal(r.windows[0].remaining, 100);
});
test('configuration rejects typos, inverted thresholds and excessive polling', () => {
  for (const input of [{ warningRemaining: 10, handoffRemaining: 20 }, { pollSeconds: 1 }, { mode: 'auto' }, { autoResume: true }, { limitIds: [] }, { handoffRemaining: NaN }, { sandbox: 'danger-full-access' }]) assert.throws(() => validateConfig(input));
});
test('default monitors all buckets including member spend window', () => {
  const m = make();
  const r = m.ingest({ rateLimitsByLimitId: { codex: { primary: window(5) }, special: { primary: window(10), individualLimit: { remainingPercent: 8, resetsAt: reset, limit: '100', used: '92' } } } }, now, true);
  assert.equal(r.canStart, false); assert.equal(r.actions[0].key, 'special/individual');
  assert.equal(r.actions[0].severity, 'handoff');
});
test('missing known bucket/window remains unknown after process restart', () => {
  const m = make(); m.ingest(payload(0, 0), now, true);
  const n = new LimitMonitor(validateConfig(), m.saved());
  assert.equal(n.ingest({ rateLimits: { limitId: 'codex', primary: window(0) } }, now + 1, true).canStart, false);
  assert.equal(n.ingest({}, now + 2, true).canStart, false);
});
