// Opt-in, real ChatGPT subscription usage: two small turns, artificial threshold only.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Controller } from '../src/controller.js';
import { RunStore, acquireLock } from '../src/store.js';
import { validateConfig } from '../src/config.js';

mkdirSync('artifacts', { recursive: true });
const cwd = mkdtempSync(resolve('artifacts/e2e-'));
const config = validateConfig({ effort: 'low' });
const evidence = { date: new Date().toISOString(), cwd, simulated: ['10% remaining threshold injected into monitor'], real: [], limitations: ['No real quota exhaustion or reset performed'] };
const lock = acquireLock(cwd);
let c, timeout;
try {
  c = new Controller({ cwd, config }); lock.update(c.rpc.child.pid);
  const runId = c.store.id;
  evidence.runId = runId;
  c.on('notice', text => console.log(text));
  c.on('message', text => console.log(text));
  await c.prepare({ goal: `This is an explicitly authorized disposable end-to-end test. Use no subagents or external services. First emit the required initial checkpoint. Then use one PowerShell command to write phase1.txt containing only 437 (use Set-Content), and wait 4 seconds in that same command (Start-Sleep -Seconds 4). This delay allows a test quota warning to reach you. After the command finishes, obey the incoming warning and emit a factual checkpoint with phase1.txt, its observed result, and next step: read phase1.txt and create phase2.txt with 444. Do not create phase2.txt in this first turn. End the turn.` });
  evidence.real.push('account/rateLimits/read through product controller with ChatGPT auth');
  evidence.initialLimits = c.state.limits;
  let injected = false;
  c.rpc.on('notification', msg => {
    if (!injected && msg.method === 'item/started' && msg.params.threadId === c.state.threadId && msg.params.item.type === 'commandExecution') {
      injected = true;
      const actualWindow = c.state.limits.windows.find(w => w.key === 'codex/primary');
      c.acceptLimits({ rateLimits: { limitId: 'codex', primary: { usedPercent: 90, windowDurationMins: actualWindow.windowDurationMins, resetsAt: actualWindow.resetsAt } } });
    }
  });
  timeout = setTimeout(() => c.fail(new Error('E2E timeout')), 180000);
  const first = await c.run();
  clearTimeout(timeout);
  assert.equal(injected, true, 'test command observed');
  assert.equal(first.status, 'paused');
  assert.ok(first.warnings.some(w => w.status === 'accepted'));
  assert.equal(first.checkpoint.source, 'agent');
  assert.ok(first.checkpoint.files.includes('phase1.txt'));
  assert.equal(readFileSync(join(cwd, 'phase1.txt'), 'utf8').trim(), '437');
  const beforeMtime = statSync(join(cwd, 'phase1.txt')).mtimeMs;
  evidence.real.push('active turn/steer accepted; agent checkpoint persisted; phase1.txt contains 437; controller paused');
  evidence.first = { status: first.status, threadId: first.threadId, warnings: first.warnings, checkpointFile: first.checkpointFile };
  await c.close();
  c = new Controller({ cwd, config, store: new RunStore(cwd, runId) }); lock.update(c.rpc.child.pid);
  c.on('message', text => console.log(text));
  await c.prepare({ resume: true });
  timeout = setTimeout(() => c.fail(new Error('Resume E2E timeout')), 180000);
  const second = await c.run({ resumePrompt: 'Continue this disposable test. First inspect phase1.txt and the saved checkpoint. If phase1.txt already contains 437, do not write it again. Read it using PowerShell, add 7 and create phase2.txt containing 444 only if not already correct. Verify both files with a command that fails if their values are incorrect. Emit the final checkpoint with exact observed test results. Do not use subagents or external services.' });
  clearTimeout(timeout);
  assert.equal(second.status, 'turn-completed');
  assert.equal(readFileSync(join(cwd, 'phase2.txt'), 'utf8').trim(), '444');
  assert.equal(statSync(join(cwd, 'phase1.txt')).mtimeMs, beforeMtime, 'phase1 action was not repeated');
  assert.ok(second.resumeInspection.files['phase1.txt'].sha256);
  assert.equal(second.checkpoint.source, 'agent');
  evidence.real.push('new app-server process thread/resume; preflight file hash; phase1 not rewritten (mtime unchanged); phase2=444; final agent checkpoint');
  evidence.second = { status: second.status, checkpointFile: second.checkpointFile, inspection: second.resumeInspection };
  evidence.passed = true;
  console.log(`E2E PASS: ${cwd}`);
} catch (error) { evidence.error = error.stack; evidence.passed = false; console.error(error); process.exitCode = 1; }
finally { clearTimeout(timeout); await c?.close(); lock.release(); writeFileSync(join(cwd, 'evidence.json'), JSON.stringify(evidence, null, 2)); }
