# Trust and security

Soft Landing runs locally with your user's permissions. A managed Codex task can
edit its selected project in the configured sandbox and uses your existing allowance.

- Codex handles authentication; the controller does not parse login-token files.
- Model API-key environment variables are removed from its app-server subprocess.
- Checkpoints/prompts/tool results may contain private project text. Keep the
  project's `.soft-landing/` folder out of Git and public uploads.
- No controller telemetry, hosted backend or automatic updater. Codex still
  communicates with OpenAI normally.
- Installers copy a skill/runtime and add a launcher. No administrator rights or
  global security changes. Windows uses a process-local execution-policy override.
- Official Node runtimes are checksum-pinned. Their license notices are included.
- ZIP hashes detect corruption, not publisher trustworthiness. Inspect source,
  CI results and the release's matching tag.

Installers are not code-signed/notarized. Use normal per-file approval if you trust
the download; do not disable platform protections globally.

Quota warnings cannot guarantee timely stops. Independent background processes
may survive the controller. Checkpoints are not backups. Unclear external effects
must be checked before resume. Interactive approvals are not supported.

Report non-sensitive bugs through [Issues](https://github.com/c0ntrix/soft-landing/issues).
For vulnerabilities use GitHub private reporting if enabled. Never publish
credentials or private source in an issue. Fixes target the latest beta.

