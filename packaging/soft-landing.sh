#!/bin/bash
set -eu
landing_app="$(cd "$(dirname "$0")" && pwd)"
exec "$landing_app/runtime/node" "$landing_app/src/cli.js" "$@"
