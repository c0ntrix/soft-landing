import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { findCodex } from './environment.js';
import { dirname, delimiter } from 'node:path';

export class AppServer extends EventEmitter {
  constructor({ executable = findCodex(), args = [], timeoutMs = 30000 } = {}) {
    super();
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    // No shell, API keys, daemon attachment or network listener.
    const env = { ...process.env };
    // CLI scripts with an env-node shebang can use the bundled runtime too.
    if (process.platform !== 'win32') env.PATH = dirname(process.execPath) + delimiter + (env.PATH || '');
    delete env.OPENAI_API_KEY;
    delete env.CODEX_API_KEY;
    this.child = spawn(executable, [...args, 'app-server', '--listen', 'stdio://'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { this.emit('diagnostic', 'Non-JSON app-server output'); return; }
      if (msg.method && msg.id !== undefined) this.emit('request', msg);
      else if (msg.method) this.emit('notification', msg);
      else {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) pending.reject(Object.assign(new Error(msg.error.message), { code: msg.error.code }));
        else pending.resolve(msg.result);
      }
    });
    this.child.stderr.on('data', data => this.emit('diagnostic', data.toString()));
    this.child.stdin.on('error', error => this.fail(error));
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => this.fail(new Error(`App-server disconnected (${code ?? signal})`)));
  }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
    this.emit('disconnect', error);
  }
  send(message) {
    if (this.closed) throw new Error('App-server is disconnected');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`${method} timed out; outcome unknown; do not replay automatically`), { uncertain: true }));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  async initialize() {
    const result = await this.request('initialize', { clientInfo: { name: 'codex_soft_landing', title: 'Soft Landing', version: '0.2.0-beta.1' }, capabilities: {} });
    this.send({ method: 'initialized', params: {} });
    return result;
  }
  respond(id, result) { this.send({ id, result }); }
  reject(id, message) { this.send({ id, error: { code: -32601, message } }); }
  close() {
    if (this.closePromise) return this.closePromise;
    this.closePromise = new Promise(resolve => {
      if (this.child.exitCode !== null || this.child.signalCode !== null || !this.child.pid) { resolve(); return; }
      this.child.once('exit', resolve);
      this.child.stdin.end();
      this.child.kill();
      // Exit is awaited before the workspace lock is released.
    });
    this.fail(new Error('App-server closed'));
    this.lines.close();
    return this.closePromise;
  }
}
