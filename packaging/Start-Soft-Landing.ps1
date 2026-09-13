$ErrorActionPreference = 'Stop'
try {
    $landingNode = Join-Path $PSScriptRoot 'runtime\node.exe'
    if (-not (Test-Path -LiteralPath $landingNode)) { throw 'Runtime missing. Extract the complete Windows download again and run INSTALL.cmd.' }
    & $landingNode (Join-Path $PSScriptRoot 'src\menu.js')
    if ($LASTEXITCODE -ne 0) { throw 'Soft Landing exited with an error.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
