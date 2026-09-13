import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RunStore } from './store.js';

export function listRuns(cwd) {
  const root = join(cwd, '.soft-landing', 'runs');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && !e.isSymbolicLink()).map(entry => {
    try { return new RunStore(cwd, entry.name).load(); }
    catch (error) { return { id: entry.name, status: 'unreadable', error: error.message }; }
  }).sort((a, b) => (b.createdAt || b.id).localeCompare(a.createdAt || a.id));
}
