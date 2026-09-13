#!/bin/bash
set -eu
landing_root="$(cd "$(dirname "$0")" && pwd)"
if /bin/bash "$landing_root/install.sh"; then
  printf '\nInstallation complete.\n'
else
  printf '\nInstallation did not complete. Please read the message above.\n'
fi
read -r -p 'Press Enter to close: ' landing_answer
