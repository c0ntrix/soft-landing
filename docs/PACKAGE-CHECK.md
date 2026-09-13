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
- 38 offline source tests passed; skill and plugin schema validation passed.

Mac packages still require their native CI results. The tagged release workflow
publishes only after Windows, Apple Silicon and Intel package jobs all pass.

The builder downloads Node 24.21.0 distributions using pinned SHA256 values, extracts
only runtime/license files, copies an explicit source allowlist and generates
per-file manifests. It excludes development artifacts, login data, live runs and caches.

ZIPs contain platform installers and self-contained skills. macOS ZIPs preserve Unix
executable bits. Installation needs no runtime download.
