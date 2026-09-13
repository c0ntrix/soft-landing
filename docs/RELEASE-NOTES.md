# Save a handoff before a usage limit interrupts the task

Soft Landing is a local skill and controller for Codex tasks. It warns the agent
as quota gets low, saves checkpoints and helps it resume from verified state.

## Download and install

Choose **windows-x64**, **macos-arm64** (Apple Silicon), or **macos-x64** (Intel).
Extract the ZIP. Open **INSTALL.cmd** on Windows or **INSTALL.command** on Mac.
The Node runtime is included; Codex with ChatGPT sign-in is required.

Open a new Codex task and say:

```text
Use $soft-landing to check my setup.
```

The desktop menu also lets you start and select saved tasks without copying run IDs.
[Full installation guide](https://github.com/c0ntrix/soft-landing/blob/main/INSTALLATION.md).

## Trust and scope

- MIT-licensed source, visible installers and checksum-pinned official Node runtimes.
- Native Windows and Mac package/install checks run in GitHub Actions before release.
- ZIP hashes and per-file manifests accompany downloads; build provenance is attested.
- The controller has no telemetry or hosted backend and does not read login tokens.

Early beta: only tasks started through Soft Landing are managed. No attachment to
existing desktop tasks, guaranteed quota stop, automatic resume or file-content
backup. Real Codex integration was tested on Windows; Mac CI uses a simulated Codex
server and does not prove real account/sandbox behavior. Installers are unsigned.

Please report setup friction with your OS, architecture and Codex version. Redact
private project content. Other coding-agent adapters are not supported yet.
