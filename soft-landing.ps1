# Optional Windows launcher. No installation, registry writes or ExecutionPolicy changes.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22+ is required. Install Node, reopen PowerShell and try again.'
}
if (-not $env:CODEX_BIN) {
    $landingCodexCommand = Get-Command codex.exe -ErrorAction SilentlyContinue
    if ($landingCodexCommand) {
        $env:CODEX_BIN = $landingCodexCommand.Source
    } else {
        $landingCodexRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
        if (Test-Path -LiteralPath $landingCodexRoot) {
            $landingCodexBinary = Get-ChildItem -LiteralPath $landingCodexRoot -Filter codex.exe -File -Recurse |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($landingCodexBinary) { $env:CODEX_BIN = $landingCodexBinary.FullName }
        }
    }
}
if (-not $env:CODEX_BIN) { throw 'Set CODEX_BIN to the absolute native codex.exe path from your Codex installation.' }
& node.exe (Join-Path $PSScriptRoot 'src\cli.js') @args
exit $LASTEXITCODE
