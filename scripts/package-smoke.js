import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const [app, cwd] = process.argv.slice(2).map(p => resolve(p));
const { Controller } = await import(pathToFileURL(join(app, 'src/controller.js')));
const { AppServer } = await import(pathToFileURL(join(app, 'src/rpc.js')));
const { RunStore } = await import(pathToFileURL(join(app, 'src/store.js')));
const { validateConfig } = await import(pathToFileURL(join(app, 'src/config.js')));
const fixture = fileURLToPath(new URL('../test/fixtures/task-server.js', import.meta.url));
let id;
for (const resume of [false, true]) {
  const rpc = new AppServer({ executable: process.execPath, args: [fixture] });
  const store = new RunStore(cwd, id);
  const c = new Controller({ cwd, config: validateConfig(), rpc, store });
  try {
    await c.prepare(resume ? { resume: true } : { goal: 'package test' });
    const result = await c.run(resume ? { resumePrompt: '' } : {});
    assert.equal(result.status, 'turn-completed');
    assert.equal(result.checkpoint.nextStep, 'verify package state');
    if (resume) assert.ok(result.resumeInspection.at);
    id = store.id;
  } finally { await c.close(); }
}
console.log('Installed controller start/resume passed with a simulated Codex server.');
