# Install Soft Landing

## Supported clients

| Client | Current support |
| --- | --- |
| Codex on Windows or Mac | Skill, desktop menu, quota monitoring, checkpoints and manual resume. Install below. |
| Claude Code | Not supported in this beta. Proposed next integration. |
| Cursor, Gemini CLI and other coding agents | Not supported in this beta. |

Soft Landing has a client-neutral name because the same need exists across coding
tools. Its current controller uses Codex-specific usage and task APIs. Installing
the skill in a different client does not monitor that client's quota or manage its tasks.

The proposed expansion has two parts: a portable checkpoint/handoff skill, and
client integrations for reported usage, warning delivery and resume. The portable
part alone would provide agent-written handoffs, not automatic usage monitoring.
Claude Code is the proposed next integration; no release date is promised.
Each supported client will get its own install, verify, update and uninstall
instructions after its behavior is tested. Share your client and workflow in
[an issue](https://github.com/c0ntrix/soft-landing/issues) to help prioritize support.

## 1. Get the right download

Open [Releases](https://github.com/c0ntrix/soft-landing/releases) and choose the latest
beta. Download one ZIP, not GitHub's automatic "Source code" archive:

| Computer | ZIP name ends with |
| --- | --- |
| Windows, Intel/AMD 64-bit | `windows-x64.zip` |
| Mac with Apple M-series chip | `macos-arm64.zip` |
| Mac with Intel processor | `macos-x64.zip` |

On Mac, Apple menu > About This Mac shows the chip. Windows ARM is not supported.
The bundled Node 24 runtime requires macOS 13.5+; Codex may require a newer OS.

## 2. Install

First install [Codex](https://learn.chatgpt.com/docs/desktop-app) and sign in with ChatGPT.

**Windows:** right-click the ZIP > Extract All. Open the extracted folder and
double-click **INSTALL.cmd**. When finished, press a key to close the window.

**Mac:** double-click the ZIP to extract it. Open the extracted folder and
double-click **INSTALL.command**. When finished, press Enter to close Terminal.

The installer scripts are unsigned. If your system blocks a download, inspect its
source and use the normal per-file approval only if you trust it. Do not disable
Gatekeeper or SmartScreen globally. On macOS, System Settings > Privacy & Security
may offer "Open Anyway" after an attempted launch.

If Finder reports missing execution permission, open Terminal, type
`/bin/bash ` (including the space), drag **INSTALL.command** into Terminal, and press Enter.
This runs the same visible installer.

The installer reports missing Codex/sign-in prerequisites after copying the files.
Open **Soft Landing** on your desktop, choose **Sign in with ChatGPT** if needed,
then **Check setup**. That check does not run a model. A real task also needs a working
Codex sandbox; Soft Landing does not turn it off to get past an error.

## 3. Start a task

Open a new Codex task. Restart Codex if the skill does not appear.

```text
Use $soft-landing to check my setup.
```

Then:

```text
Use $soft-landing to start this task in my project: summarize the project and identify its test command.
```

Or open the desktop menu > **Start a new task**, paste your project folder's path,
and describe the task. This starts a separate Codex task with quota monitoring.
Keep its window/process open. Ctrl+C asks it to pause.

To return later, use the skill or **View or resume a saved task** in the menu.
Choose the task by its description. No run ID needs to be copied in the menu.

## Files, updates and removal

- Installed skill: `~/.codex/skills/soft-landing`, under your user profile on Windows.
  An existing `CODEX_HOME` is respected.
- Desktop launcher: `Soft Landing.lnk` on Windows; `Soft Landing.command` on Mac.
- Project records: `<project>/.soft-landing/`. Add it to the project's `.gitignore`.
- No background service, administrator install, PATH change or separate sign-in.
  The Windows launcher uses a process-local PowerShell execution-policy override.
- After installation you may delete the extracted download folder.

**Update:** stop active tasks, move the installed `soft-landing` folder to a backup
outside the `skills` directory, remove the old desktop launcher, and run the new
installer. Project checkpoints stay in the project. Check a resumed task before
removing the backup.

**Uninstall:** stop active tasks, remove the installed skill folder and desktop
launcher. Project records remain; delete them separately only if no longer needed.
Codex and your account are unaffected.

## For Codex performing installation

Use the latest release asset matching OS and architecture. Do not install the
source-only skill folder: release packaging adds the controller and runtime.
Download the ZIP and its `.sha256` from this repository's release. Compare SHA256,
extract into a fresh folder, read `install.ps1` or `install.sh`, and run the installer
within the user's installation request.

Windows: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <install.ps1>`.
macOS: `/bin/bash <install.sh>`. These avoid the interactive closing prompt.
Do not overwrite an existing installation automatically. Run the installed CLI's
`doctor --json`; report setup readiness separately from available quota.
Do not start a model task just to validate installation.

If a matching release is unavailable, report that rather than installing an incomplete
skill folder. Maintainers can build with `python scripts/build-release.py --platform <target>`.
For custom Codex paths, read [CLI setup](docs/CLI.md).
