#!/bin/bash
set -eu
landing_root="$(cd "$(dirname "$0")" && pwd)"
landing_source="$landing_root/soft-landing/skills/soft-landing"
landing_skill_root="${SOFT_LANDING_SKILL_ROOT:-${CODEX_HOME:-$HOME/.codex}/skills}"
landing_shortcuts="${SOFT_LANDING_SHORTCUT_DIR:-$HOME/Desktop}"
case "$landing_skill_root" in /*) ;; *) printf 'Installation path must be absolute.\n' >&2; exit 1;; esac
if [ "$(uname -s)" != Darwin ]; then printf 'This package requires macOS.\n' >&2; exit 1; fi
landing_expected_arch="$(cat "$landing_source/app/runtime/arch.txt")"
landing_actual_arch="$(uname -m)"
if [ "$landing_expected_arch" != "$landing_actual_arch" ]; then
  printf 'Wrong package: this is for %s, your Mac reports %s. Download the matching ZIP.\n' "$landing_expected_arch" "$landing_actual_arch" >&2
  exit 1
fi
landing_target="$landing_skill_root/soft-landing"
if [ -e "$landing_target" ] || [ -L "$landing_target" ]; then
  printf 'Already installed: %s\nFor updates, stop active tasks and rename the old skill folder first. See INSTALLATION.md.\n' "$landing_target" >&2
  exit 1
fi
(cd "$landing_source/app/runtime" && /usr/bin/shasum -a 256 -c node.sha256)
"$landing_source/app/runtime/node" --version
mkdir -p "$landing_skill_root"
landing_stage="$(mktemp -d "$landing_skill_root/.soft-landing-install.XXXXXX")"
cp -R "$landing_source/." "$landing_stage/"
chmod +x "$landing_stage/app/runtime/node" "$landing_stage/app/soft-landing" "$landing_stage/app/Start-Soft-Landing.command"
mv "$landing_stage" "$landing_target"
printf 'Installed: %s\n' "$landing_target"
mkdir -p "$landing_shortcuts"
if [ ! -e "$landing_shortcuts/Soft Landing.command" ] && [ ! -L "$landing_shortcuts/Soft Landing.command" ]; then
  ln -s "$landing_target/app/Start-Soft-Landing.command" "$landing_shortcuts/Soft Landing.command"
else
  printf 'Existing desktop launcher was preserved.\n'
fi
if [ "${SOFT_LANDING_NO_CHECK:-0}" != 1 ]; then
  "$landing_target/app/soft-landing" doctor || printf 'Files installed. Resolve the prerequisite above, then run Check setup again.\n'
fi
printf 'Open a new Codex task (restart Codex if needed): Use $soft-landing to check my setup.\nOr open Soft Landing.command on your Desktop.\n'
