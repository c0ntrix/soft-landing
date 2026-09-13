// Account-free app-server fixture for native package tests. No model/network calls.
import { createInterface } from 'node:readline';
let thread = 'package-thread';
const emit = (method, params) => process.stdout.write(JSON.stringify({ method, params }) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  const reply = result => process.stdout.write(JSON.stringify({ id: m.id, result }) + '\n');
  if (m.method === 'initialize') reply({ userAgent: 'package-test' });
  else if (m.method === 'account/read') reply({ account: { type: 'chatgpt' } });
  else if (m.method === 'account/rateLimits/read') reply({ rateLimits: { limitId: 'codex', primary: { usedPercent: 0, windowDurationMins: 300, resetsAt: Date.now() / 1000 + 3600 } } });
  else if (m.method === 'thread/start' || m.method === 'thread/resume') reply({ thread: { id: thread, status: { type: 'idle' }, turns: [] } });
  else if (m.method === 'turn/start') {
    reply({ turn: { id: 'package-turn' } });
    emit('turn/started', { threadId: thread, turn: { id: 'package-turn' } });
    setTimeout(() => {
      const checkpoint = { goal: 'package test', completed: ['fixture turn'], files: [], tests: ['fixture only'], open: [], uncertain: [], nextStep: 'verify package state' };
      emit('item/completed', { threadId: thread, item: { id: 'message', type: 'agentMessage', text: '<soft-landing-checkpoint>' + JSON.stringify(checkpoint) + '</soft-landing-checkpoint>' } });
      emit('turn/completed', { threadId: thread, turn: { id: 'package-turn', status: 'completed' } });
    }, 25);
  } else if (m.id !== undefined) reply({});
});
