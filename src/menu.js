import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { realpathSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { main } from './cli.js';
import { listRuns } from './runs.js';
import { findCodex } from './environment.js';
import { dirname, delimiter } from 'node:path';

async function ask(text) {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return (await rl.question(text)).trim(); } finally { rl.close(); }
}
async function project() {
  const raw = (await ask('Project folder (paste its full path): ')).replace(/^"|"$/g, '');
  if (!raw) throw new Error('No project folder was provided.');
  const cwd = realpathSync(raw);
  if (!statSync(cwd).isDirectory()) throw new Error('Please select a folder.');
  return cwd;
}
const labels = { paused: 'Paused', 'turn-completed': 'Turn completed', 'needs-attention': 'Needs attention', created: 'Prepared', blocked: 'Start blocked', unreadable: 'Cannot read saved state' };
console.log('\nSOFT LANDING - Graceful checkpoints for Codex tasks\nOnly tasks started through Soft Landing are managed.');
while (true) {
  console.log('\n1  Check setup\n2  Show quota\n3  Start a new task\n4  View or resume a saved task\n5  Sign in with ChatGPT\n0  Exit\n');
  const choice = await ask('Choose: ');
  if (choice === '0') { process.exitCode = 0; break; }
  process.exitCode = 0;
  try {
    if (choice === '1') await main(['doctor']);
    else if (choice === '2') await main(['limits']);
    else if (choice === '3') {
      const cwd = await project();
      const prompt = await ask('What should Codex do in this project? ');
      if (!prompt) throw new Error('Please enter a task.');
      console.log('This task uses your Codex quota and can edit project files.\nKeep this window open. Ctrl+C requests an orderly pause.');
      await main(['start', '--cwd', cwd, '--prompt', prompt]);
    } else if (choice === '4') {
      const cwd = await project();
      const runs = listRuns(cwd);
      if (!runs.length) { console.log('There are no Soft Landing tasks in this project yet.'); continue; }
      runs.forEach((r, i) => console.log(`${i + 1}  ${labels[r.status] || r.status} | ${(r.goal || r.error || r.id).replace(/[\r\n]/g, ' ').slice(0, 140)}`));
      const selected = Number(await ask('Task number (0 = back): '));
      if (selected === 0) continue;
      if (!Number.isInteger(selected) || !runs[selected - 1]) throw new Error('That number is not in the list.');
      const run = runs[selected - 1];
      await main(['status', '--cwd', cwd, '--run', run.id]);
      if ((await ask('Resume this task now? (y/N): ')).toLowerCase() === 'y') {
        await main(['resume', '--cwd', cwd, '--run', run.id]);
      }
    } else if (choice === '5') {
      const code = await new Promise((resolve, reject) => {
        const env = { ...process.env };
        if (process.platform !== 'win32') env.PATH = dirname(process.execPath) + delimiter + (env.PATH || '');
        const child = spawn(findCodex(), ['login'], { stdio: 'inherit', windowsHide: true, env });
        child.on('error', reject); child.on('exit', resolve);
      });
      if (code !== 0) throw new Error('Sign-in did not complete. Please try again.');
      await main(['doctor']);
    } else console.log('Please choose a number from the menu.');
  } catch (error) { console.error(`\nNotice: ${error.message}`); }
}
