#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { Controller } from './controller.js';
import { AppServer } from './rpc.js';
import { LimitMonitor } from './limits.js';
import { RunStore, acquireLock, unlock } from './store.js';
import { doctor } from './doctor.js';
import { listRuns } from './runs.js';

const help = `Codex Soft Landing 0.2.0-beta.1
Usage:
  node src/cli.js doctor [--json]
  node src/cli.js limits [--config file]
  node src/cli.js start --cwd DIRECTORY --prompt "TASK" [--config file]
  node src/cli.js start --cwd DIRECTORY --prompt-file task.md [--config file]
  node src/cli.js status --cwd DIRECTORY [--run ID]
  node src/cli.js resume --cwd DIRECTORY --run ID [--prompt-file continuation.md] [--config file]
  node src/cli.js unlock --cwd DIRECTORY

Requires Node >=22, Codex CLI and codex login with ChatGPT.
CODEX_BIN may point to a native Codex executable (Windows: codex.exe).
Ctrl+C requests an orderly checkpoint/pause; second Ctrl+C requests interruption.
Only sessions started here are managed. No automatic resume, API billing or resets.`;

export function displayLimits(result) {
  console.log(`Limit data: ${result.health}`);
  for (const w of result.windows) console.log(`${w.key}: ${w.remaining}% remaining | ${w.windowDurationMins ?? '?'} min | reset ${Number.isFinite(w.resetsAt) ? new Date(w.resetsAt * 1000).toLocaleString() : 'unknown'}`);
  for (const issue of result.issues) console.log(issue);
}
export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { cwd: { type: 'string' }, config: { type: 'string' }, run: { type: 'string' }, prompt: { type: 'string' }, json: { type: 'boolean' }, 'prompt-file': { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  const command = positionals[0];
  if (values.help || !command) { console.log(help); return; }
  if (positionals.length !== 1 || !['doctor', 'limits', 'start', 'status', 'resume', 'unlock'].includes(command)) throw new Error(help);
  if (values.prompt !== undefined && values['prompt-file']) throw new Error('Use either --prompt or --prompt-file, not both.');
  if (command === 'doctor') {
    const result = await doctor();
    console.log(values.json ? JSON.stringify(result) : [...result.checks, result.error || 'Setup is ready.'].join('\n'));
    if (!result.ok) process.exitCode = 2;
    return;
  }
  const cwd = realpathSync(resolve(values.cwd || process.cwd()));
  if (command === 'unlock') { unlock(cwd); console.log('Stale controller lock removed. Inspect the saved run before resume.'); return; }
  if (command === 'status') {
    const states = values.run ? [new RunStore(cwd, values.run).load()] : listRuns(cwd);
    if (!states.length) console.log('No Soft Landing tasks in this project yet.');
    for (const state of states) {
      console.log(JSON.stringify({ id: state.id, status: state.status, threadId: state.threadId, goal: state.goal, checkpoint: state.checkpointFile, nextStep: state.checkpoint?.nextStep, tools: state.tools, warnings: state.warnings, error: state.error, needsAttention: state.needsAttention }, null, 2));
    }
    return;
  }
  const savedConfig = command === 'resume' && values.run && !values.config ? new RunStore(cwd, values.run).load().config : null;
  const config = savedConfig ? loadSavedConfig(savedConfig) : loadConfig(values.config);
  if (command === 'limits') {
    const rpc = new AppServer();
    try { await rpc.initialize(); const result = new LimitMonitor(config).ingest(await rpc.request('account/rateLimits/read'), Date.now(), true); displayLimits(result); if (!result.canStart) process.exitCode = 2; }
    finally { await rpc.close(); }
    return;
  }
  if (command === 'start' && !values['prompt-file'] && values.prompt === undefined) throw new Error('start requires --prompt or --prompt-file');
  if (command === 'resume' && !values.run) throw new Error('resume requires --run');
  const prompt = values['prompt-file'] ? readFileSync(values['prompt-file'], 'utf8').replace(/^\uFEFF/, '').trim() : (values.prompt || '').trim();
  if (command === 'start' && !prompt) throw new Error('Prompt file is empty');
  const lock = acquireLock(cwd);
  let controller;
  let signals = 0;
  const onSignal = () => { signals++; (signals === 1 ? controller?.pause() : controller?.interrupt()).catch(e => controller.fail(e)); };
  try {
    controller = new Controller({ cwd, config, store: new RunStore(cwd, values.run) });
    lock.update(controller.rpc.child.pid);
    controller.on('message', text => console.log(text));
    controller.on('notice', text => console.error(`[Soft Landing] ${text}`));
    controller.on('checkpoint', name => console.log(`[Checkpoint saved] ${name}`));
    console.log(`Run: ${controller.store.id}\nState: ${controller.store.dir}`);
    await controller.prepare({ goal: prompt, resume: command === 'resume' });
    process.on('SIGINT', onSignal);
    const state = await controller.run(command === 'resume' ? { resumePrompt: prompt } : {});
    console.log(`Run ${state.id}: ${state.status}. Resume manually with --run ${state.id}.`);
    if (!['turn-completed', 'paused'].includes(state.status)) process.exitCode = 2;
  } finally { process.off('SIGINT', onSignal); await controller?.close(); lock.release(); }
}
import { validateConfig as loadSavedConfig } from './config.js';
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Soft Landing: ${error.message}`); process.exitCode = 1; });
