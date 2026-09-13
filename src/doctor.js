import { AppServer } from './rpc.js';
import { LimitMonitor } from './limits.js';
import { defaults } from './config.js';
import { findCodex } from './environment.js';

export async function doctor({ rpcFactory = () => new AppServer(), executable = () => findCodex() } = {}) {
  const result = { ok: false, node: process.version, codex: null, checks: [], canStart: false };
  let rpc;
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or later is required. Use the complete download for your operating system.');
    result.codex = executable();
    rpc = rpcFactory();
    await rpc.initialize();
    result.checks.push('Connected to Codex.');
    const auth = await rpc.request('account/read', { refreshToken: false });
    if (auth.account?.type !== 'chatgpt') throw new Error('ChatGPT sign-in is missing. Choose option 5 in the Soft Landing menu to sign in.');
    result.checks.push('Signed in with ChatGPT.');
    const limits = new LimitMonitor(defaults).ingest(await rpc.request('account/rateLimits/read'), Date.now(), true);
    result.canStart = limits.canStart;
    result.limitHealth = limits.health;
    if (limits.health === 'unknown') throw new Error('Limit data is missing or incomplete. Check your connection and run Check setup again.');
    result.checks.push(limits.canStart ? 'Limits available; enough quota to start.' : 'Limits available; insufficient quota to start right now. Check again later.');
    result.checks.push('No model call was made. The Codex sandbox is only exercised by an actual task.');
    result.ok = true;
  } catch (error) { result.error = error.message; }
  finally { await rpc?.close(); }
  return result;
}
