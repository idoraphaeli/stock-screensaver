# Installs the built screensaver for the current user (no admin needed):
#   1. Finds the newest packaged build under release\ (the output folder
#      name can vary between builds)
#   2. Copies it to %LOCALAPPDATA%\StockScreensaver — a stable location,
#      so rebuilding or deleting the repo won't break the screensaver
#   3. Registers it as the Windows screensaver for the current user
#
# Run after `npm run electron:build`, from anywhere:
#   powershell -ExecutionPolicy Bypass -File "<project>\scripts\install-screensaver.ps1"

$ErrorActionPreference = 'Stop'

$releaseRoot = Join-Path $PSScriptRoot "..\release"
$exe = Get-ChildItem -Path $releaseRoot -Recurse -Filter "StockScreensaver.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $exe) {
    Write-Error "No build found under release\. Run 'npm run electron:build' first."
}
$source = $exe.DirectoryName
Write-Host "Using build: $source (built $($exe.LastWriteTime))"

$target = Join-Path $env:LOCALAPPDATA "StockScreensaver"

# Preserve the user's stock list across reinstalls — screens.json lives in
# this same folder (edited by the Telegram bot) and must survive an update.
$configFile = Join-Path $target "screens.json"
$savedConfig = $null
if (Test-Path $configFile) {
    $savedConfig = Get-Content -Raw $configFile
    Write-Host "Preserving existing screens.json ..."
}

Write-Host "Copying to $target ..."
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Copy-Item -Recurse $source $target
Copy-Item (Join-Path $target "StockScreensaver.exe") (Join-Path $target "StockScreensaver.scr") -Force

if ($savedConfig) { Set-Content -Path $configFile -Value $savedConfig -Encoding UTF8 }

$scr = Join-Path $target "StockScreensaver.scr"
Write-Host "Registering $scr as the screensaver ..."
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'SCRNSAVE.EXE' -Value $scr
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive' -Value '1'
# Idle seconds before the screensaver kicks in (300 = 5 minutes):
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '300'

Write-Host ""
Write-Host "Done. The screensaver starts after 5 idle minutes."
Write-Host "To adjust or preview: Settings > Personalization > Lock screen > Screen saver."
