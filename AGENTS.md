# Working with Soft Landing

For installation requests, follow INSTALLATION.md and use a complete platform
release. Copying the source skill directory alone omits its controller/runtime.

For code changes, run `node --test test/*.test.js`. For installer or packaging
changes, build the native release and run `scripts/verify-package.py` on that
platform. Keep real account/model tests separate from offline CI.

Keep public docs and user-facing messages in English. Do not commit live runs,
credentials, downloaded binaries or development research. Do not claim an agent
or platform integration works solely because its manifest validates.
