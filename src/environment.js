import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

// Shared by the CLI, installer check and menu. Never execute a shell shim.
export function findCodex(env = process.env, platform = process.platform) {
  if (env.CODEX_BIN) {
    if (!isAbsolute(env.CODEX_BIN) || !existsSync(env.CODEX_BIN) || (platform === 'win32' && !env.CODEX_BIN.toLowerCase().endsWith('.exe'))) {
      throw new Error('CODEX_BIN must point to an existing Codex executable (Windows: codex.exe).');
    }
    return env.CODEX_BIN;
  }
  const name = platform === 'win32' ? 'codex.exe' : 'codex';
  for (const folder of (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':')) {
    const candidate = join(folder, name);
    if (folder && existsSync(candidate)) return candidate;
  }
  if (platform === 'darwin') {
    for (const candidate of [
      '/Applications/Codex.app/Contents/Resources/codex',
      env.HOME && join(env.HOME, 'Applications/Codex.app/Contents/Resources/codex'),
      '/opt/homebrew/bin/codex', '/usr/local/bin/codex',
    ].filter(Boolean)) if (existsSync(candidate)) return candidate;
    throw new Error('Codex was not found. Install Codex and sign in with ChatGPT. For a custom installation, set CODEX_BIN to the Codex executable.');
  }
  if (platform !== 'win32') return name;
  const root = env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
  const found = [];
  function scan(dir, depth) {
    if (!dir || !existsSync(dir) || depth < 0) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'codex.exe') found.push(file);
      else if (entry.isDirectory() && !entry.isSymbolicLink()) scan(file, depth - 1);
    }
  }
  scan(root, 3);
  // Native executable inside an npm CLI installation, if present.
  if (env.APPDATA) scan(join(env.APPDATA, 'npm', 'node_modules', '@openai'), 7);
  found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (found[0]) return found[0];
  throw new Error('Codex was not found. Install the Codex desktop app, sign in with ChatGPT and try again. For a custom installation, set CODEX_BIN to the native codex.exe.');
}
