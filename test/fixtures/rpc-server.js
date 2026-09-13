import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const m = JSON.parse(line);
  const reply = result => process.stdout.write(JSON.stringify({ id: m.id, result }) + '\n');
  if (m.method === 'initialize') reply({ test: true });
  if (m.method === 'echo') setTimeout(() => reply(m.params), m.params.delay || 0);
  if (m.method === 'notify') {
    process.stdout.write('not json\n');
    process.stdout.write(JSON.stringify({ method: 'sample', params: { ok: true } }) + '\n');
    reply({ ok: true });
  }
  if (m.method === 'env') reply({ openai: !!process.env.OPENAI_API_KEY, codex: !!process.env.CODEX_API_KEY });
  if (m.method === 'exit') process.exit(4);
});
