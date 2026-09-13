import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, openSync, closeSync, fsyncSync, appendFileSync, unlinkSync, statSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export function atomicJson(file, value) {
  mkdirSync(resolve(file, '..'), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = openSync(temp, 'wx');
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
}
export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}
export function acquireLock(cwd) {
  const root = join(cwd, '.soft-landing'); mkdirSync(root, { recursive: true });
  const file = join(root, 'controller.lock');
  let fd;
  try { fd = openSync(file, 'wx'); } catch (e) {
    if (e.code === 'EEXIST') throw new Error('Workspace locked. Inspect status; use unlock only after the previous controller and its app-server have stopped.');
    throw e;
  }
  const token = randomUUID();
  const update = childPid => { writeFileSync(file, JSON.stringify({ pid: process.pid, childPid, token })); };
  closeSync(fd); update(null);
  return { update, release() { const current = JSON.parse(readFileSync(file, 'utf8')); if (current.token === token) unlinkSync(file); } };
}
export function unlock(cwd) {
  const file = join(cwd, '.soft-landing/controller.lock');
  const lock = JSON.parse(readFileSync(file, 'utf8'));
  if (alive(lock.pid) || alive(lock.childPid)) throw new Error('Controller or app-server PID is still alive; unlock refused.');
  unlinkSync(file);
}
export function snapshot(cwd, files = []) {
  const result = { at: new Date().toISOString(), git: null, files: {} };
  const git = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
  result.git = git.status === 0 ? git.stdout : 'unavailable (not a Git worktree or git failed)';
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  result.head = head.status === 0 ? head.stdout.trim() : null;
  for (const file of files.slice(0, 200)) {
    const path = resolve(cwd, file), rel = relative(cwd, path);
    if (rel.startsWith('..') || isAbsolute(rel)) { result.files[file] = 'outside workspace; inspect manually'; continue; }
    try {
      const actualRel = relative(cwd, realpathSync(path));
      if (actualRel.startsWith('..') || isAbsolute(actualRel)) { result.files[file] = 'symlink outside workspace; inspect manually'; continue; }
      const stat = statSync(path);
      result.files[file] = stat.isFile() && stat.size <= 5 * 1024 * 1024 ? { sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), bytes: stat.size } : 'directory or >5 MB; inspect manually';
    } catch (e) { result.files[file] = e.code === 'ENOENT' ? 'missing' : 'unreadable'; }
  }
  return result;
}
export function parseCheckpoints(text) {
  const found = [];
  for (const match of text.matchAll(/<soft-landing-checkpoint>\s*([\s\S]*?)\s*<\/soft-landing-checkpoint>/g)) {
    const value = JSON.parse(match[1]);
    for (const key of ['goal', 'nextStep']) if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Checkpoint missing ${key}`);
    for (const key of ['completed', 'files', 'tests', 'open', 'uncertain']) if (!Array.isArray(value[key]) || value[key].some(x => typeof x !== 'string')) throw new Error(`Checkpoint requires string array ${key}`);
    found.push(value);
  }
  return found;
}
export class RunStore {
  constructor(cwd, id = randomUUID()) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid run ID');
    this.dir = join(cwd, '.soft-landing', 'runs', id);
    this.id = id;
    mkdirSync(this.dir, { recursive: true });
  }
  load() { return JSON.parse(readFileSync(join(this.dir, 'state.json'), 'utf8')); }
  save(state) { atomicJson(join(this.dir, 'state.json'), state); }
  event(type, data) {
    const file = join(this.dir, 'events.jsonl');
    const fd = openSync(file, 'a');
    try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), type, data }) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  }
  checkpoint(value, state) {
    const record = { at: new Date().toISOString(), ...value, actualState: snapshot(state.cwd, value.files) };
    const name = `checkpoint-${Date.now()}-${randomUUID().slice(0, 8)}.json`;
    atomicJson(join(this.dir, name), record);
    state.checkpoint = record;
    state.checkpointFile = name;
    this.save(state);
    return record;
  }
}
