$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22 x64 (including npm), then reopen PowerShell.'
}
& node (Join-Path $PSScriptRoot 'electron-cli.mjs') build @args
exit $LASTEXITCODE
