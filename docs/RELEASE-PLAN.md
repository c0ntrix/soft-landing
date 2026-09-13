# Release procedure

1. Update package version, CLI/protocol version, plugin metadata and release notes.
2. Run offline tests and the native package installation checks.
3. Push main and confirm all three platform jobs pass in GitHub Actions.
4. Create and push the matching `v<version>` tag. The tag workflow repeats the
   platform checks, attests the ZIPs and publishes a GitHub prerelease.
5. Verify all download links, the checksums and the rendered README before promotion.

Use the tagged workflow's outputs as the release files. Do not attach private run
records or local research artifacts. Public source is MIT licensed; bundled Node
and third-party notices remain in each runtime directory.

Publishing a tag is an explicit release action. Posting to X or Reddit is a
separate action; the [launch drafts](LAUNCH.md) do not post themselves.
