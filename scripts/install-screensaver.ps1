# Installs the built screensaver for the current user (no admin needed):
#   1. Copies release\win-unpacked to %LOCALAPPDATA%\StockScreensaver
#      (a stable location, so rebuilding/deleting the repo won't break it)
#   2. Registers it as the Windows screensaver for the current user
#
# Run from the project root after `npm run electron:build`:
#   powershell -ExecutionPolicy Bypass -File scripts\install-screensaver.ps1

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot "..\release\win-unpacked"
if (-not (Test-Path (Join-Path $source "StockScreensaver.exe"))) {
    Write-Error "Build output not found. Run 'npm run electron:build' first."
}

$target = Join-Path $env:LOCALAPPDATA "StockScreensaver"
Write-Host "Copying build to $target ..."
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Copy-Item -Recurse $source $target
Copy-Item (Join-Path $target "StockScreensaver.exe") (Join-Path $target "StockScreensaver.scr") -Force

$scr = Join-Path $target "StockScreensaver.scr"
Write-Host "Registering $scr as the screensaver ..."
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE' -Value $scr
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive' -Value '1'
# Idle seconds before the screensaver kicks in (300 = 5 minutes):
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '300'

Write-Host ""
Write-Host "Done. The screensaver starts after 5 idle minutes."
Write-Host "To adjust or preview: Settings > Personalization > Lock screen > Screen saver."
