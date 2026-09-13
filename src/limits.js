// Pure quota policy. No model calls, clocks, network or filesystem access.
export class LimitMonitor {
  constructor(config, saved = {}) { this.config = config; this.buckets = {}; this.sent = saved.sent || {}; this.expected = saved.expected || {}; this.health = null; }
  ingest(payload, now, full = false) {
    const map = payload?.rateLimitsByLimitId;
    const incoming = map && Object.keys(map).length ? map : payload?.rateLimits ? { [payload.rateLimits.limitId || 'codex']: payload.rateLimits } : {};
    const previousBuckets = this.buckets;
    if (full) this.buckets = {};
    for (const [id, value] of Object.entries(incoming)) {
      if (!value || typeof value !== 'object') continue;
      const bucket = this.buckets[id] || { windows: {} };
      for (const key of ['primary', 'secondary', 'individual']) {
        const individual = value.individualLimit;
        const w = key === 'individual' ? (individual ? { usedPercent: typeof individual.remainingPercent === 'number' ? 100 - individual.remainingPercent : NaN, resetsAt: individual.resetsAt, windowDurationMins: null } : null) : value[key];
        if (!w) {
          // A formerly known window disappearing from a full read is unavailable, not unlimited.
          if (full && (previousBuckets[id]?.windows[key] || this.expected[`${id}/${key}`])) bucket.windows[key] = { invalid: true, at: now };
          continue; // Sparse notifications cannot clear a known window or refresh its age.
        }
        this.expected[`${id}/${key}`] = true;
        if (typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100) { bucket.windows[key] = { invalid: true, at: now }; continue; }
        const previous = bucket.windows[key];
        if (!full && previous && Number.isFinite(w.resetsAt) && Number.isFinite(previous.resetsAt) && w.resetsAt < previous.resetsAt) continue;
        // Reordered sparse values within the same window must not falsely recover quota.
        const usedPercent = !full && previous?.resetsAt === w.resetsAt ? Math.max(previous.usedPercent || 0, w.usedPercent) : w.usedPercent;
        bucket.windows[key] = { ...w, usedPercent, remaining: 100 - usedPercent, at: now };
      }
      for (const key of ['spendControlReached', 'rateLimitReachedType']) if (value[key] != null || full) bucket[key] = value[key] ?? null;
      this.buckets[id] = bucket;
    }
    return this.evaluate(now);
  }
  evaluate(now) {
    const windows = [], issues = [], actions = [];
    let blocked = false;
    const ids = this.config.limitIds.includes('*') ? [...new Set([...Object.keys(this.buckets), ...Object.keys(this.expected).map(key => key.slice(0, key.lastIndexOf('/')))])] : this.config.limitIds;
    if (!ids.length) issues.push('No limit buckets available');
    for (const id of ids) {
      const bucket = this.buckets[id];
      if (!bucket || !Object.keys(bucket.windows).length) { issues.push(`${id}: limit data unavailable`); continue; }
      if (bucket.spendControlReached || bucket.rateLimitReachedType) blocked = true;
      for (const [name, w] of Object.entries(bucket.windows)) {
        const key = `${id}/${name}`;
        const expired = Number.isFinite(w.resetsAt) && w.resetsAt * 1000 <= now;
        const stale = now - w.at > this.config.staleSeconds * 1000;
        if (w.invalid || stale || expired) { issues.push(`${key}: ${w.invalid ? 'invalid' : expired ? 'reset needs fresh confirmation' : 'stale'}`); continue; }
        windows.push({ key, ...w });
        const severity = w.remaining <= this.config.handoffRemaining ? 'handoff' : w.remaining <= this.config.warningRemaining ? 'warning' : null;
        const old = this.sent[key];
        const newPeriod = old && Number.isFinite(w.resetsAt) && Number.isFinite(old.reset) && w.resetsAt > old.reset;
        if (newPeriod || w.remaining > this.config.warningRemaining + 2) delete this.sent[key];
        const sent = this.sent[key];
        if (severity && (!sent || (severity === 'handoff' && sent.severity === 'warning'))) {
          actions.push({ key, severity, remaining: w.remaining, resetsAt: w.resetsAt ?? null });
          this.sent[key] = { severity, reset: w.resetsAt ?? null };
        }
      }
    }
    const health = issues.length ? 'unknown' : blocked ? 'blocked' : 'fresh';
    if (health !== this.health && health !== 'fresh') actions.push({ key: 'data', severity: 'handoff', reason: blocked ? 'Account reports a reached limit' : issues.join('; ') });
    this.health = health;
    return { health, windows, issues, actions, canStart: health === 'fresh' && windows.length > 0 && windows.every(w => w.remaining > this.config.handoffRemaining) };
  }
  saved() { return { sent: this.sent, expected: this.expected }; }
}
