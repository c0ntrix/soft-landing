import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppServer } from '../src/rpc.js';

const dir = resolve('artifacts/integration-smoke');
mkdirSync(dir, { recursive: true });
const rpc = new AppServer();
const evidence = { date: new Date().toISOString(), simulated: 'Only the quota warning; real quota is not depleted.', events: [] };
let done;
const completed = new Promise(resolve => { done = resolve; });
rpc.on('notification', msg => {
  if (['turn/started', 'turn/completed', 'item/completed', 'account/rateLimits/updated'].includes(msg.method)) evidence.events.push(msg);
  if (msg.method === 'turn/completed') done(msg.params);
});
rpc.on('request', msg => rpc.reject(msg.id, 'This disposable smoke test needs no external tools or approvals.'));
const timer = setTimeout(() => { console.error('Integration timed out'); rpc.close(); process.exitCode = 1; done(null); }, 120000);
try {
  evidence.server = await rpc.initialize();
  const auth = await rpc.request('account/read');
  if (auth.account?.type !== 'chatgpt') throw new Error('ChatGPT login required; no API usage permitted');
  const limits = await rpc.request('account/rateLimits/read');
  evidence.limits = { rateLimits: limits.rateLimits, rateLimitsByLimitId: limits.rateLimitsByLimitId };
  const { thread, model } = await rpc.request('thread/start', { cwd: dir, sandbox: 'read-only', approvalPolicy: 'never', ephemeral: false });
  evidence.threadId = thread.id;
  evidence.model = model;
  const { turn } = await rpc.request('turn/start', { threadId: thread.id, effort: 'low', input: [{ type: 'text', text: 'This is an explicitly authorized disposable integration test. No external services, no subagents, no tools. Think briefly about a two-step task: calculate 19*23, then add 7. An additional user instruction will arrive during this turn. Follow it. Return at most 100 words.' }] });
  evidence.steer = await rpc.request('turn/steer', { threadId: thread.id, expectedTurnId: turn.id, input: [{ type: 'text', text: 'SOFT_LANDING_TEST_WARNING: simulated 10% remaining, not actual quota. Acknowledge this exact marker and give a checkpoint containing goal, completed steps, files (none), test result of the calculation, open work and next step. Then finish this turn. No tools.' }] });
  evidence.completion = await completed;
  const messages = evidence.events.filter(e => e.method === 'item/completed' && e.params.item.type === 'agentMessage').map(e => e.params.item.text).join('\n');
  evidence.warningAcknowledged = messages.includes('SOFT_LANDING_TEST_WARNING');
  writeFileSync(resolve(dir, 'checkpoint.md'), messages);
  if (!evidence.warningAcknowledged || evidence.completion?.turn.status !== 'completed') throw new Error('Warning not acknowledged or turn failed');
  console.log(JSON.stringify({ threadId: thread.id, model, steerAccepted: evidence.steer, warningAcknowledged: true, checkpoint: resolve(dir, 'checkpoint.md') }, null, 2));
} catch (e) { evidence.error = e.message; console.error(e.message); process.exitCode = 1; }
finally { clearTimeout(timer); writeFileSync(resolve(dir, 'evidence.json'), JSON.stringify(evidence, null, 2)); rpc.close(); }
