#!/bin/bash
set -eu
# Resolve a Desktop symlink before finding the installed app directory.
landing_script="$0"
if [ -L "$landing_script" ]; then landing_script="$(readlink "$landing_script")"; fi
landing_app="$(cd "$(dirname "$landing_script")" && pwd)"
"$landing_app/runtime/node" "$landing_app/src/menu.js" || {
  printf '\nSoft Landing could not start. Please read INSTALLATION.md.\n'
  read -r -p 'Press Enter to close: ' landing_answer
  exit 1
}
