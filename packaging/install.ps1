param(
    [string]$SkillRoot,
    [string]$ShortcutDirectory,
    [switch]$NoCheck
)
$ErrorActionPreference = 'Stop'
try {
    if ($env:PROCESSOR_ARCHITEW6432 -eq 'ARM64' -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This package requires Windows x64. Windows ARM is not yet supported.' }
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'This package requires Windows x64.' }
    if (-not $SkillRoot) {
        $landingCodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
        $SkillRoot = Join-Path $landingCodexHome 'skills'
    }
    if (-not [System.IO.Path]::IsPathRooted($SkillRoot)) { throw 'The skill folder must be an absolute path.' }
    $SkillRoot = [System.IO.Path]::GetFullPath($SkillRoot)
    $landingSource = Join-Path $PSScriptRoot 'soft-landing\skills\soft-landing'
    $landingTarget = [System.IO.Path]::GetFullPath((Join-Path $SkillRoot 'soft-landing'))
    if (-not $landingTarget.StartsWith($SkillRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid installation target.' }
    if (Test-Path -LiteralPath $landingTarget) {
        throw ('Soft Landing is already installed here: ' + $landingTarget + '. To update, stop active tasks and rename the old skill folder first; see INSTALLATION.md. Nothing was overwritten.')
    }
    $landingNode = Join-Path $landingSource 'app\runtime\node.exe'
    $landingPin = Get-Content -LiteralPath (Join-Path $landingSource 'app\runtime\runtime.json') -Raw | ConvertFrom-Json
    $landingStream = [System.IO.File]::OpenRead($landingNode)
    $landingHasher = [System.Security.Cryptography.SHA256]::Create()
    try { $landingHash = [BitConverter]::ToString($landingHasher.ComputeHash($landingStream)).Replace('-', '').ToLowerInvariant() }
    finally { $landingStream.Dispose(); $landingHasher.Dispose() }
    if ($landingHash -ne $landingPin.sha256) { throw 'The Node runtime is damaged. Download the ZIP again and extract it completely.' }
    & $landingNode --version
    if ($LASTEXITCODE -ne 0) { throw 'The bundled runtime could not start.' }
    New-Item -ItemType Directory -Path $SkillRoot -Force | Out-Null
    $landingStage = Join-Path $SkillRoot ('.soft-landing-install-' + [guid]::NewGuid().ToString('N'))
    Copy-Item -LiteralPath $landingSource -Destination $landingStage -Recurse
    # Move only this verified staging directory into the exact, previously absent target.
    $landingStageFull = [System.IO.Path]::GetFullPath($landingStage)
    if (-not $landingStageFull.StartsWith($SkillRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid staging folder.' }
    Move-Item -LiteralPath $landingStageFull -Destination $landingTarget
    Write-Host ('Installed: ' + $landingTarget) -ForegroundColor Green
    if (-not $ShortcutDirectory) { $ShortcutDirectory = [Environment]::GetFolderPath('Desktop') }
    try {
        if (-not (Test-Path -LiteralPath $ShortcutDirectory)) { New-Item -ItemType Directory -Path $ShortcutDirectory -Force | Out-Null }
        $landingShell = New-Object -ComObject WScript.Shell
        $landingShortcutPath = Join-Path $ShortcutDirectory 'Soft Landing.lnk'
        if (Test-Path -LiteralPath $landingShortcutPath) { throw 'A desktop shortcut with this name already exists.' }
        $landingShortcut = $landingShell.CreateShortcut($landingShortcutPath)
        $landingShortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $landingShortcut.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $landingTarget 'app\Start-Soft-Landing.ps1') + '"'
        $landingShortcut.WorkingDirectory = Join-Path $landingTarget 'app'
        $landingShortcut.Description = 'Soft Landing - Graceful checkpoints for Codex tasks'
        $landingShortcut.Save()
        Write-Host ('Start: ' + $landingShortcutPath)
    } catch { Write-Host ('Desktop shortcut was not created: ' + $_.Exception.Message + '. You can also run app\Start-Soft-Landing.ps1 in the installed skill folder.') -ForegroundColor Yellow }
    if (-not $NoCheck) {
        & (Join-Path $landingTarget 'app\runtime\node.exe') (Join-Path $landingTarget 'app\src\cli.js') doctor
        if ($LASTEXITCODE -ne 0) { Write-Host 'Files are installed. Resolve the prerequisite shown above, then choose Check setup from the menu.' -ForegroundColor Yellow }
    }
    Write-Host 'Open a new Codex task (restart Codex if needed). Then: Use $soft-landing to check my setup.'
    Write-Host 'Or double-click the Soft Landing desktop shortcut. No administrator access or Node installation required.'
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
