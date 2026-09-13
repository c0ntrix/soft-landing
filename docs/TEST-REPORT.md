# Validation

## Original controller, 0.1.0-rc.1

2026-09-09: Windows 10 x64, Node 24.13.0, Codex CLI 0.153.4, ChatGPT sign-in.

- 35 offline tests passed.
- Real quota reads completed without model calls.
- A real short task accepted and acknowledged a steering warning.
- A two-turn real test paused, saved a checkpoint, resumed through a new server and
  verified files without rewriting the first result.
- Warning percentages were injected. No real quota exhaustion or reset redemption.

Raw development records may contain project text and are excluded from public downloads.

## Current release

Windows, macOS Apple Silicon and macOS Intel each passed 40 offline tests and native
package installation checks in this
[successful CI run](https://github.com/c0ntrix/soft-landing/actions/runs/34783852040).
The tag workflow repeats these checks before publishing downloads.

[Package verification](PACKAGE-CHECK.md) records local and CI results. Offline tests use
fake Codex responses with real local processes/files: thresholds, resets, sparse data,
preflight races, RPC timeouts, disconnects, checkpoints, locks and resume checks.

No guarantee of a timely stop or exactly-once external effects. No real quota
exhaustion/reset, prolonged load or power-loss test. macOS CI does not establish
real Codex sign-in, sandbox or model behavior on a user's Mac.
