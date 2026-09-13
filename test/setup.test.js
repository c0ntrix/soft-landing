import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findCodex } from '../src/environment.js';
import { doctor } from '../src/doctor.js';
import { listRuns } from '../src/runs.js';
import { RunStore } from '../src/store.js';

test('discovery finds a desktop executable without Node or Codex on PATH', () => {
  const root = mkdtempSync(join(tmpdir(), 'landing-discovery-'));
  try {
    const binary = join(root, 'OpenAI', 'Codex', 'bin', 'version', 'codex.exe');
    mkdirSync(join(binary, '..'), { recursive: true }); writeFileSync(binary, 'fixture');
    assert.equal(findCodex({ LOCALAPPDATA: root, PATH: '' }, 'win32'), binary);
    assert.throws(() => findCodex({ CODEX_BIN: join(root, 'missing.exe') }, 'win32'), /CODEX_BIN/);
    const mac = join(root, 'Applications', 'Codex.app', 'Contents', 'Resources', 'codex');
    mkdirSync(join(mac, '..'), { recursive: true }); writeFileSync(mac, 'fixture');
    assert.equal(findCodex({ HOME: root, PATH: '' }, 'darwin'), mac);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setup separates installation readiness from quota and never starts a turn', async () => {
  for (const scenario of ['ready', 'low', 'missing', 'api-key', 'disconnected']) {
    const calls = []; let closed = false;
    const result = await doctor({ executable: () => 'fixture', rpcFactory: () => ({
      async initialize() { if (scenario === 'disconnected') throw new Error('offline'); },
      async request(method) {
        calls.push(method);
        if (method === 'account/read') return { account: { type: scenario === 'api-key' ? 'apiKey' : 'chatgpt' } };
        if (method === 'account/rateLimits/read') return scenario === 'missing' ? {} : { rateLimits: { limitId: 'codex', primary: { usedPercent: scenario === 'low' ? 95 : 0, windowDurationMins: 300, resetsAt: Date.now() / 1000 + 3600 } } };
        throw new Error('Unexpected operation');
      },
      async close() { closed = true; }
    }) });
    assert.equal(result.ok, ['ready', 'low'].includes(scenario));
    assert.equal(result.canStart, scenario === 'ready');
    assert.equal(closed, true);
    assert.ok(calls.every(method => method.startsWith('account/')));
  }
});

test('saved-task listing handles empty projects and keeps damaged entries visible', () => {
  const root = mkdtempSync(join(tmpdir(), 'landing-list-'));
  try {
    assert.deepEqual(listRuns(root), []);
    const store = new RunStore(root, 'first');
    store.save({ id: 'first', goal: 'resume this', status: 'paused', createdAt: '2026-01-01' });
    mkdirSync(join(root, '.soft-landing/runs/broken'));
    const runs = listRuns(root);
    assert.equal(runs.length, 2);
    assert.equal(runs.find(r => r.id === 'first').goal, 'resume this');
    assert.equal(runs.find(r => r.id === 'broken').status, 'unreadable');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
