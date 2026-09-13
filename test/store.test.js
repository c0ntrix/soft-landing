import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunStore, acquireLock, unlock, atomicJson, snapshot, parseCheckpoints } from '../src/store.js';

export const cp = { goal: 'test', completed: ['one'], files: ['file.txt'], tests: ['verified'], open: ['two'], uncertain: [], nextStep: 'two' };
test('atomic state survives reopen, immutable checkpoints and file change inspection', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'landing-store-'));
  try {
    writeFileSync(join(cwd, 'file.txt'), 'one');
    const store = new RunStore(cwd); const state = { cwd };
    store.checkpoint(cp, state); const first = state.checkpointFile;
    const before = new RunStore(cwd, store.id).load().checkpoint.actualState;
    writeFileSync(join(cwd, 'file.txt'), 'two');
    assert.notEqual(snapshot(cwd, cp.files).files['file.txt'].sha256, before.files['file.txt'].sha256);
    store.checkpoint({ ...cp, nextStep: 'three' }, state);
    assert.ok(existsSync(join(store.dir, first))); assert.notEqual(state.checkpointFile, first);
    store.event('uncertain', { id: 'tool-1' }); assert.match(readFileSync(join(store.dir, 'events.jsonl'), 'utf8'), /tool-1/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('workspace lock refuses concurrent owners and unlocking live PID', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'landing-lock-'));
  try { const lock = acquireLock(cwd); assert.throws(() => acquireLock(cwd), /locked/); assert.throws(() => unlock(cwd), /alive/); lock.release(); const next = acquireLock(cwd); next.release(); }
  finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('stale lock can be explicitly removed; run path traversal refused', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'landing-lock-'));
  try { atomicJson(join(cwd, '.soft-landing/controller.lock'), { pid: null, childPid: null }); unlock(cwd); assert.throws(() => new RunStore(cwd, '../oops')); }
  finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('checkpoints reject incomplete or malformed fields; outside paths not read', () => {
  assert.deepEqual(parseCheckpoints(`<soft-landing-checkpoint>${JSON.stringify(cp)}</soft-landing-checkpoint>`), [cp]);
  assert.throws(() => parseCheckpoints('<soft-landing-checkpoint>{}</soft-landing-checkpoint>'));
  assert.throws(() => parseCheckpoints('<soft-landing-checkpoint>broken</soft-landing-checkpoint>'));
  assert.deepEqual(parseCheckpoints('ordinary message'), []);
  assert.equal(snapshot(process.cwd(), ['../outside.txt']).files['../outside.txt'], 'outside workspace; inspect manually');
});
