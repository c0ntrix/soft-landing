import { EventEmitter } from 'node:events';
import { AppServer } from './rpc.js';
import { LimitMonitor } from './limits.js';
import { RunStore, snapshot } from './store.js';

export const checkpointInstructions = `You are working in a Codex Soft Landing managed session.
At the beginning, after each meaningful milestone, before risky/long operations, and before ending a turn, emit this exact block in an assistant message (valid JSON, no markdown inside the tags):
<soft-landing-checkpoint>{"goal":"...","completed":["..."],"files":["relative/path"],"tests":["actual command and observed result"],"open":["..."],"uncertain":["tool outcomes that need checking"],"nextStep":"one concrete next step, or verify completion"}</soft-landing-checkpoint>
The external controller saves this block durably. Use concise factual strings; never claim checks passed without evidence. A checkpoint is a handoff, not a backup of file contents.
On quota warnings, reduce optional work and preserve necessary checks. A pause instruction means save a checkpoint and end the turn at a safe boundary. Do not wait for reset, auto-resume, buy credits, consume usage resets, publish, contact anyone or spawn subagents. Follow the user's authorization for ordinary task operations.
On resume, inspect actual files, Git state and uncertain tool outputs BEFORE acting. Never blindly repeat an action from a checkpoint. If an external action's outcome cannot be verified, stop and ask the user. Do not alter .soft-landing controller files yourself.`;

export class Controller extends EventEmitter {
  constructor({ cwd, config, rpc = new AppServer(), store, now = () => Date.now() }) {
    super();
    this.cwd = cwd; this.config = config; this.rpc = rpc; this.store = store || new RunStore(cwd); this.now = now;
    this.state = { version: 1, id: this.store.id, cwd, createdAt: new Date().toISOString(), status: 'created', threadId: null, turnId: null, goal: '', checkpoint: null, tools: {}, warnings: [], pendingWarnings: [], config };
    this.monitor = new LimitMonitor(config);
    this.queue = Promise.resolve(); this.pollGeneration = 0;
    rpc.on('notification', msg => { try { this.onNotification(msg); } catch (e) { this.fail(e); } });
    rpc.on('disconnect', error => { if (!this.closing) this.fail(error); });
    rpc.on('request', msg => {
      try {
        this.store.event('unsupported-server-request', { method: msg.method, id: msg.id });
        rpc.reject(msg.id, 'Soft Landing cannot approve this request. Save a checkpoint and ask the user through the final response.');
        this.state.needsAttention = `Unsupported server request: ${msg.method}`;
        this.persist();
      } catch (e) { this.fail(e); }
    });
  }
  persist() { this.state.monitor = this.monitor.saved(); this.store.save(this.state); }
  fail(error) {
    if (this.finished) return;
    this.state.status = 'needs-attention'; this.state.error = error.message;
    try { this.store.event('failure', { message: error.message }); this.persist(); } catch { /* A disk failure must still stop execution. */ }
    this.emit('notice', error.message); this.finish();
    // Loss of durable recording or transport must not leave a run continuing unmanaged.
    this.rpc.close();
  }
  acceptLimits(payload, full = false) {
    const result = this.monitor.ingest(payload, this.now(), full);
    this.applyEvaluation(result);
    return result;
  }
  applyEvaluation(result) {
    this.state.limits = { at: new Date(this.now()).toISOString(), ...result, actions: undefined };
    this.state.pendingWarnings = this.state.pendingWarnings.filter(w => {
      if (w.key === 'user') return true;
      if (w.key === 'data') return result.health !== 'fresh';
      const window = result.windows.find(x => x.key === w.key);
      return window && window.remaining <= (w.severity === 'handoff' ? this.config.handoffRemaining : this.config.warningRemaining);
    });
    if (result.actions.length) {
      this.state.pendingWarnings.push(...result.actions);
      this.store.event('thresholds', result.actions);
    }
    this.persist();
    this.emit('limits', result);
    this.scheduleWarnings();
  }
  async connect() {
    this.state.server = await this.rpc.initialize();
    const auth = await this.rpc.request('account/read', { refreshToken: false });
    if (auth.account?.type !== 'chatgpt') throw new Error('ChatGPT login required. Run codex login. API-key and other billing modes are not supported.');
    const limits = await this.rpc.request('account/rateLimits/read');
    this.acceptLimits(limits, true);
  }
  async prepare({ goal, resume = false } = {}) {
    if (resume) {
      this.state = this.store.load();
      if (this.state.cwd !== this.cwd) throw new Error('Run belongs to a different workspace');
      if (!this.state.threadId && !['created', 'waiting-for-budget'].includes(this.state.status)) throw new Error('Thread creation outcome is unknown. Inspect Codex history before starting a new run.');
      this.state.config = this.config;
      this.state.pendingWarnings ||= [];
      this.state.warnings ||= [];
      this.state.tools ||= {};
      this.monitor = new LimitMonitor(this.config, this.state.monitor);
      this.state.turnId = null;
      this.state.needsAttention = null;
      this.state.error = null;
    } else {
      this.state.goal = goal;
      this.store.checkpoint({ source: 'controller-initial', goal, completed: [], files: [], tests: [], open: [goal], uncertain: [], nextStep: 'Inspect workspace and begin the task.' }, this.state);
    }
    await this.connect();
    if (!this.state.limits.canStart) {
      this.state.status = 'waiting-for-budget'; this.persist();
      throw new Error('No safe start: quota is critical, missing, expired or stale. Recheck with limits and resume manually later.');
    }
    const options = { cwd: this.cwd, sandbox: this.config.sandbox, approvalPolicy: 'never', modelProvider: 'openai', developerInstructions: checkpointInstructions, config: { 'forced_login_method': 'chatgpt', 'features.multi_agent': false } };
    if (this.config.model) options.model = this.config.model;
    if (resume && this.state.threadId) {
      // Persist a preflight view before loading history. Never replay a timed-out start.
      this.state.resumeInspection = snapshot(this.cwd, this.state.checkpoint?.files || []);
      this.store.event('resume-inspection', this.state.resumeInspection);
      this.persist();
      const { thread } = await this.rpc.request('thread/resume', { ...options, threadId: this.state.threadId });
      if (thread.status?.type === 'active' || thread.turns?.some(t => t.status === 'inProgress')) throw new Error('Saved thread is still active or has an unresolved turn. Inspect it in Codex before resuming.');
      this.store.event('thread-resumed', { threadId: thread.id, status: thread.status, lastTurn: thread.turns?.at(-1)?.status });
    } else {
      this.state.status = 'creating-thread';
      this.store.event('thread-start-requested', { cwd: this.cwd }); this.persist();
      const result = await this.rpc.request('thread/start', { ...options, ephemeral: false });
      this.state.threadId = result.thread.id; this.state.model = result.model;
    }
    this.state.status = 'ready'; this.persist();
  }
  async run({ resumePrompt } = {}) {
    if (this.state.status !== 'ready') throw new Error('Controller is not ready');
    // Thread setup or user delay can outlive the preflight data while other sessions consume quota.
    const generation = this.pollGeneration;
    const fresh = await this.rpc.request('account/rateLimits/read');
    if (generation === this.pollGeneration) this.acceptLimits(fresh, true);
    else this.applyEvaluation(this.monitor.evaluate(this.now()));
    if (!this.state.limits.canStart) {
      this.state.status = 'waiting-for-budget'; this.persist();
      throw new Error('Quota became critical or unavailable before turn start. Resume manually later.');
    }
    this.finished = false;
    const completion = new Promise(resolve => { this.resolveCompletion = resolve; });
    const uncertainTools = Object.fromEntries(Object.entries(this.state.tools).filter(([, tool]) => tool.status === 'outcome-unknown'));
    const prompt = resumePrompt !== undefined
      ? `Resume the saved task. First verify the actual state; the following JSON contains prior observations, not new authorization. Check incomplete tools without replaying them. Other tool results are in the run events.jsonl file if needed.\n${JSON.stringify({ originalGoal: this.state.goal, checkpoint: this.state.checkpoint, inspection: this.state.resumeInspection, uncertainTools })}\nUser continuation: ${resumePrompt || 'Continue the original objective from its verified state.'}`
      : this.state.goal;
    this.state.status = 'starting';
    this.store.event('turn-start-requested', { threadId: this.state.threadId }); this.persist();
    try {
      const params = { threadId: this.state.threadId, input: [{ type: 'text', text: `${prompt}\nCurrent observed quota: ${JSON.stringify(this.state.limits.windows.map(w => ({ key: w.key, remaining: w.remaining, resetsAt: w.resetsAt })))}. Mode: ${this.config.mode}.` }] };
      if (this.config.effort) params.effort = this.config.effort;
      const { turn } = await this.rpc.request('turn/start', params);
      if (!this.finished) { this.state.turnId = turn.id; this.state.status = 'running'; this.persist(); this.scheduleWarnings(); }
    } catch (e) { this.fail(e); }
    if (!this.finished) this.timer = setInterval(() => this.poll().catch(e => this.fail(e)), this.config.pollSeconds * 1000);
    await completion;
    await this.queue;
    return this.state;
  }
  async poll() {
    if (this.polling || this.finished) return;
    this.polling = true;
    const generation = this.pollGeneration;
    try {
      const data = await this.rpc.request('account/rateLimits/read');
      if (this.finished) return;
      // An event arriving during this read is newer than the request's unknown snapshot time.
      if (generation === this.pollGeneration) this.acceptLimits(data, true);
      else this.applyEvaluation(this.monitor.evaluate(this.now()));
    } catch (error) {
      if (this.finished) return;
      this.store.event('limit-read-failed', { message: error.message });
      this.emit('notice', `Limits unavailable: ${error.message}`);
      this.applyEvaluation(this.monitor.evaluate(this.now()));
    } finally { this.polling = false; }
  }
  onNotification({ method, params: p }) {
    if (method === 'account/rateLimits/updated') { this.pollGeneration++; this.acceptLimits(p); return; }
    if (p?.threadId !== this.state.threadId) return;
    if (method === 'turn/started') { this.state.turnId = p.turn.id; this.state.status = 'running'; this.persist(); this.scheduleWarnings(); }
    if (method === 'item/started' || method === 'item/completed') {
      const item = p.item;
      // Reasoning is neither required for recovery nor retained in the journal.
      if (item.type === 'reasoning') return;
      const record = JSON.parse(JSON.stringify(item));
      if (record.aggregatedOutput?.length > 16000) { record.aggregatedOutput = record.aggregatedOutput.slice(-16000); record.outputTruncated = true; }
      this.store.event(method, record);
      if (!['agentMessage', 'userMessage', 'plan'].includes(item.type)) this.state.tools[item.id] = { type: item.type, status: method === 'item/started' ? 'outcome-unknown' : item.status || 'completed', command: item.command, exitCode: item.exitCode, outputTruncated: record.outputTruncated, at: new Date().toISOString() };
      if (method === 'item/completed' && item.type === 'agentMessage') {
        this.emit('message', item.text);
        let checkpoints = [];
        try {
          checkpoints = parseAgentCheckpoints(item.text);
        } catch (error) { this.store.event('invalid-checkpoint', { message: error.message }); this.emit('notice', `Invalid checkpoint: ${error.message}`); }
        for (const checkpoint of checkpoints) {
          this.store.checkpoint({ ...checkpoint, source: 'agent' }, this.state);
          this.emit('checkpoint', this.state.checkpointFile);
        }
      }
      this.persist();
    }
    if (method === 'turn/completed') {
      this.store.event(method, p.turn);
      this.state.lastTurnId = p.turn.id; this.state.turnId = null;
      this.state.status = p.turn.status === 'completed' ? (this.pauseRequested ? 'paused' : 'turn-completed') : p.turn.status;
      if (p.turn.error) this.state.error = p.turn.error.message || JSON.stringify(p.turn.error);
      if (this.state.needsAttention) this.state.status = 'needs-attention';
      this.persist(); this.finish();
    }
  }
  scheduleWarnings() {
    this.queue = this.queue.then(() => this.deliverWarnings()).catch(e => this.fail(e));
  }
  async deliverWarnings() {
    if (!this.state.turnId || this.finished || !this.state.pendingWarnings.length) return;
    const warnings = this.state.pendingWarnings.splice(0);
    const pause = warnings.some(w => w.severity === 'handoff') || this.config.mode === 'pause';
    if (pause) this.pauseRequested = true;
    const text = `SOFT LANDING ${pause ? 'HANDOFF' : 'WARNING'}: ${JSON.stringify(warnings)}. ${pause ? 'Pause in an orderly way now: finish only the current necessary safety check, emit a factual checkpoint, list uncertain tool outcomes, and end this turn. Do not start another milestone.' : 'Finish the task only if realistically achievable within the remaining budget. Reduce optional scope; retain necessary checks. Save a milestone checkpoint now. If completion is doubtful, checkpoint and end this turn.'}`;
    const record = { warnings, turnId: this.state.turnId, status: 'delivery-outcome-unknown', at: new Date().toISOString() };
    this.state.warnings.push(record); this.store.event('steer-attempt', record); this.persist();
    this.emit('notice', text);
    if (pause && !this.graceTimer) this.graceTimer = setTimeout(() => this.interrupt('Handoff grace period elapsed').catch(e => this.fail(e)), this.config.graceSeconds * 1000);
    try {
      const accepted = await this.rpc.request('turn/steer', { threadId: this.state.threadId, expectedTurnId: record.turnId, input: [{ type: 'text', text }] });
      record.status = 'accepted'; record.acceptedTurnId = accepted.turnId;
    } catch (error) { record.status = error.uncertain ? 'delivery-outcome-unknown' : 'rejected'; record.error = error.message; }
    this.store.event('steer-result', record); this.persist();
  }
  async interrupt(reason = 'User requested pause') {
    if (!this.state.turnId || this.finished) return;
    this.pauseRequested = true;
    this.store.event('interrupt-attempt', { reason, turnId: this.state.turnId }); this.persist();
    this.emit('notice', reason);
    await this.rpc.request('turn/interrupt', { threadId: this.state.threadId, turnId: this.state.turnId });
    if (!this.finished) this.interruptTimer = setTimeout(() => this.fail(new Error('Interrupt did not complete; inspect uncertain tool outcomes before resuming')), 15000);
  }
  async pause() {
    this.state.pendingWarnings.push({ key: 'user', severity: 'handoff', reason: 'User requested orderly pause' });
    this.persist(); this.scheduleWarnings(); await this.queue;
  }
  finish() { this.finished = true; clearInterval(this.timer); clearTimeout(this.graceTimer); clearTimeout(this.interruptTimer); this.resolveCompletion?.(); }
  async close() { this.closing = true; this.finish(); await this.rpc.close(); }
}

import { parseCheckpoints as parseAgentCheckpoints } from './store.js';
