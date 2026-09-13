# Package verification

## Windows local checks, 2026-09-13

The Windows ZIP was built, extracted into a fresh directory with spaces in its
name, and installed with Windows PowerShell using the included Node 24.21.0 runtime.
No Node installation or npm dependency download was needed.

- Every packaged file matched the per-file manifest; ZIP SHA256 matched.
- Installer, desktop shortcut creation, CLI help and menu startup passed.
- Empty-project status produced a clear message.
- Reinstallation refused to overwrite an existing installation; a user file survived.
- Missing Codex produced a structured setup error without a model call.
- The installed controller completed start/checkpoint/resume through a real stdio
  subprocess using a simulated Codex server.
- 40 offline source tests passed; skill and plugin schema validation passed.
- Real Windows Codex setup checks passed with CLI 0.154.0-alpha.6.2: ChatGPT account,
  reported quota and discovery of the installed skill. These checks made no model calls.

## Native CI checks, 2026-09-13

[All three platform jobs passed](https://github.com/c0ntrix/soft-landing/actions/runs/34783852040)
on Windows x64, macOS Apple Silicon and macOS Intel. Each job passed 40 source tests,
built its native ZIP, verified its manifest and installed it into an isolated path
with spaces. Bundled-runtime CLI/menu startup, reinstallation protection and a
simulated task/checkpoint/resume flow passed on each platform.

The Mac checks use a simulated Codex server. Real Mac account, sandbox and model
behavior still need user testing. The tagged release workflow repeats these checks
and publishes only after all three platform jobs pass.

The builder downloads Node 24.21.0 distributions using pinned SHA256 values, extracts
only runtime/license files, copies an explicit source allowlist and generates
per-file manifests. It excludes development artifacts, login data, live runs and caches.

ZIPs contain platform installers and self-contained skills. macOS ZIPs preserve Unix
executable bits. Installation needs no runtime download.
