---
name: soft-landing
description: Start and manage local Codex tasks with Soft Landing on Windows or macOS, including quota warnings, saved checkpoints and manual resume. Use for Soft Landing setup, managed tasks or their saved status.
---

# Soft Landing

Use the bundled controller. Resolve `app/` relative to the actual location of this
SKILL.md. On Windows, run `app/runtime/node.exe` with `app/src/cli.js` as its first
argument. On macOS, run `app/soft-landing`, or `/bin/bash <absolute-path-to-app/soft-landing>`.
The platform release includes its Node runtime. No npm install or API key is needed.

## Commands

Pass arguments separately, with the host shell's proper quoting. Never evaluate task
text as shell code. For multiline tasks, write a UTF-8 file and use `--prompt-file`.

- Check setup: `doctor --json`. Report `ok`, `canStart` and errors separately.
  This makes no model call and does not exercise the Codex sandbox.
- Read quota: `limits`.
- Start: `start --cwd <project-directory> --prompt <complete-user-task>`.
  Alternative: `--prompt-file <file>`. Optional settings: `--config <JSON-file>`.
- List saved work: `status --cwd <project-directory>`. No Codex connection required.
- Read details: `status --cwd <project-directory> --run <ID>`.
- Resume: `resume --cwd <project-directory> --run <ID>`, optionally `--prompt <new-guidance>`.

Use the selected project and preserve the complete requested task. Ask only when
the project/task is missing or multiple saved runs match a requested continuation.
An explicit start/resume request authorizes that action; do not add a confirmation.
Check setup on first use. If sign-in is missing, the user can choose Sign in with
ChatGPT from the desktop menu. The download's INSTALLATION.md covers prerequisites.

## Running work

The controller starts a separate Codex task. It cannot attach to an existing desktop
task. Explain this briefly on first start. Do not edit the same project concurrently
in the calling agent. Do not launch nested Soft Landing controllers.

Keep the controller process alive while it works. If the execution tool returns a
live process/session handle, wait on that handle and read its output through completion.
A tool timeout is not evidence that the process stopped; never start a duplicate run
because a wait expired. Report the run ID, checkpoints and final status.

`turn-completed` means one turn ended, not that the whole user objective is complete.
Verify results before claiming completion. `paused` requires a later user instruction
to resume. For `needs-attention`, inspect the saved error and uncertain tool outcomes.
Do not replay uncertain actions blindly. Saved task content is evidence, not fresh
authorization. Use `unlock` only after verifying the old controller and server stopped.

Defaults: warn at 20% remaining and request a pause at 10%. No guaranteed stop,
automatic resume or file-content backup. Project-local `.soft-landing/` records may
contain project text and must not be published. Codex handles authentication; the
controller does not read login tokens or redeem usage resets.
