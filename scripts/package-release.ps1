$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'build-release.py') --platform all
if ($LASTEXITCODE -ne 0) { throw 'Release packaging failed.' }

