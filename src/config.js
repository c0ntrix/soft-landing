import { readFileSync } from 'node:fs';

export const defaults = Object.freeze({ warningRemaining: 20, handoffRemaining: 10, mode: 'finish', pollSeconds: 60, staleSeconds: 180, graceSeconds: 120, limitIds: ['*'], sandbox: 'workspace-write', model: null, effort: null });
export function validateConfig(input = {}) {
  for (const key of Object.keys(input)) if (!(key in defaults)) throw new Error(`Unknown configuration key: ${key}`);
  const c = { ...defaults, ...input };
  for (const key of ['warningRemaining', 'handoffRemaining', 'pollSeconds', 'staleSeconds', 'graceSeconds']) if (!Number.isFinite(c[key])) throw new Error(`Invalid ${key}`);
  if (!(c.handoffRemaining >= 0 && c.handoffRemaining < c.warningRemaining && c.warningRemaining <= 100)) throw new Error('Require 0 <= handoffRemaining < warningRemaining <= 100');
  if (c.pollSeconds < 10 || c.staleSeconds < c.pollSeconds * 2 || c.graceSeconds < 10 || c.graceSeconds > 3600) throw new Error('Require pollSeconds >= 10, staleSeconds >= 2*pollSeconds, graceSeconds 10..3600');
  if (!['finish', 'pause'].includes(c.mode)) throw new Error('mode must be finish or pause');
  if (!['workspace-write', 'read-only'].includes(c.sandbox)) throw new Error('sandbox must be workspace-write or read-only');
  if (!Array.isArray(c.limitIds) || !c.limitIds.length || c.limitIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(c.limitIds).size !== c.limitIds.length) throw new Error('limitIds must be unique nonempty strings');
  if (c.limitIds.includes('*') && c.limitIds.length !== 1) throw new Error('Use ["*"] alone, or explicit limit IDs');
  if (c.model !== null && (typeof c.model !== 'string' || !c.model.trim())) throw new Error('model must be null or a model name');
  if (c.effort !== null && !['low', 'medium', 'high', 'xhigh'].includes(c.effort)) throw new Error('Invalid effort');
  return c;
}
export function loadConfig(path) { return validateConfig(path ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : {}); }
