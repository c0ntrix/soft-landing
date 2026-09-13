# Contributing

Include OS/architecture, Soft Landing and Codex versions, expected behavior and
actual results in bug reports. Redact project text/account details; do not attach
entire run directories.

Describe the behavior a change fixes. Add a focused regression test where needed.

```sh
node --test test/*.test.js
python scripts/build-release.py --platform windows-x64
```

Use the matching macOS target on a Mac. Installer checks belong on every supported
platform. Real model tests require the account owner's authorization.
Do not commit credentials, local run records or downloaded binaries.

Keep the controller small. Prioritize setup, understandable errors and reliable
resume over unverified provider support.

