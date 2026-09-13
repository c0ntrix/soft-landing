# CLI guide

Source use needs Node.js 22+ and Codex signed in with ChatGPT. No npm install.

```sh
node src/cli.js doctor
node src/cli.js limits
node src/cli.js start --cwd "/path/to/project" --prompt "Your complete task"
node src/cli.js status --cwd "/path/to/project"
node src/cli.js resume --cwd "/path/to/project" --run RUN_ID
```

Use `--prompt-file task.md` for multiline instructions. Resume accepts new guidance
with `--prompt` or `--prompt-file`. The project must exist. Git is optional.
The menu is `node src/menu.js`.

The installed skill includes its runtime. Windows: run `<skill>/app/runtime/node.exe`
with `<skill>/app/src/cli.js` and the command arguments. Mac:
`<skill>/app/soft-landing` accepts the same arguments.

## Codex discovery

The tool checks PATH and standard desktop/CLI installation locations. For a custom
installation set `CODEX_BIN` to the absolute executable path. Windows requires a
native `codex.exe`, not a `codex.cmd` shim.

```powershell
$env:CODEX_BIN = 'C:\path\to\codex.exe'
node src/cli.js doctor
```

```sh
export CODEX_BIN="/path/to/codex"
node src/cli.js doctor
```

Sign in through `codex login` or the menu. Agent tasks require ChatGPT sign-in;
API-key authentication is rejected.

## Configuration

Use `--config soft-landing.example.json`. Resume uses saved settings unless
explicitly replaced. Unknown keys and invalid values fail.

| Key | Default | Meaning |
| --- | --- | --- |
| `warningRemaining` | 20 | Warn at or below this remaining percentage |
| `handoffRemaining` | 10 | Request pause; block new turns |
| `mode` | `finish` | Finish if realistic; otherwise checkpoint and end |
| `mode: "pause"` | optional | Request pause already at the warning threshold |
| `pollSeconds` | 60 | Extra quota read interval; minimum 10 |
| `staleSeconds` | 180 | Maximum received-data age |
| `graceSeconds` | 120 | Time before requesting interruption |
| `limitIds` | `["*"]` | All reported pools/windows |
| `sandbox` | `workspace-write` | Alternative: `read-only` |
| `model`, `effort` | `null` | Inherit Codex settings |

A clock reaching the reset time does not establish that quota renewed. Server data
must confirm it. Missing known windows block new turns. Explicit pool IDs can be
selected; the controller does not guess model-to-pool mappings.

## State and recovery

Under `<project>/.soft-landing/runs/<run-id>/`:

- `state.json`: atomically replaced controller state.
- `checkpoint-*.json`: goal, progress, files, checks, open issues, uncertain outcomes,
  next step, Git state and file hashes.
- `events.jsonl`: durable tool/message journal.

Checkpoints do not back up file contents. Resume checks up to 200 mentioned files
and hashes files up to 5 MB. Paths outside the project are rejected. Actual state
must be checked before repeating actions with uncertain outcomes.

Ctrl+C requests a pause; a second Ctrl+C requests interruption. An expired grace
period requests interruption too. Separately launched background processes may survive.

After a crash, inspect the saved state and verify the controller/server stopped.
Only then use `unlock --cwd <project>`. Do not resume the same run in concurrent
clients. There is no universal exactly-once guarantee for external effects.

