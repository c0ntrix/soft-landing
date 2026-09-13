// Optional real CLI check. Isolated skill home; no model or account mutation.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
const [app, codexHome, cwd] = process.argv.slice(2).map(p => resolve(p));
const { AppServer } = await import(pathToFileURL(join(app, 'src/rpc.js')));
process.env.CODEX_HOME = codexHome;
const rpc = new AppServer();
try {
  await rpc.initialize();
  const result = await rpc.request('skills/list', { cwds: [cwd], forceReload: true });
  const skill = result.data?.flatMap(item => item.skills || []).find(item => item.name === 'soft-landing');
  assert.ok(skill, 'Installed skill must be discovered by the real Codex CLI');
  assert.ok(realpathSync(skill.path).startsWith(realpathSync(codexHome)), 'Must discover the isolated installation, not another copy');
  console.log('Real Codex discovered the installed soft-landing skill.');
} finally { await rpc.close(); }
