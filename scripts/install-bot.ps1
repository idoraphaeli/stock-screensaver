# Registers the Telegram control bot to start (hidden) at logon, so it's
# always listening for your messages.
#
# Prerequisite: finish bot/README.md setup first (token + allowedChatId in
# bot/bot-config.json), and confirm it works with `npm run bot`.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File "<project>\scripts\install-bot.ps1"
#
# Remove later with:  schtasks /delete /tn StockScreensaverBot /f

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$botScript = Join-Path $projectRoot 'bot\telegram-bot.cjs'
$botConfig = Join-Path $projectRoot 'bot\bot-config.json'

if (-not (Test-Path $botScript)) { Write-Error "Bot script not found at $botScript" }
if (-not (Test-Path $botConfig)) {
    Write-Error "bot\bot-config.json not found. Complete the setup in bot\README.md first."
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error "Node.js not found on PATH. Install Node, then re-run." }

# A tiny VBScript launcher runs Node with no visible console window. Task
# Scheduler can't hide a console on its own, so we go through wscript.
$launcher = Join-Path $env:LOCALAPPDATA 'StockScreensaver\run-bot-hidden.vbs'
New-Item -ItemType Directory -Force (Split-Path $launcher) | Out-Null
# VBS runs Node hidden: Run "<node>" "<script>", 0 (hidden window), False
# (don't wait). Quotes are doubled per VBScript string escaping; the
# here-string keeps them literal so PowerShell doesn't mangle them.
$vbs = @"
CreateObject("WScript.Shell").Run """$node"" ""$botScript""", 0, False
"@
Set-Content -Path $launcher -Value $vbs -Encoding ASCII

Write-Host "Registering logon task 'StockScreensaverBot' ..."
schtasks /create /tn StockScreensaverBot /tr "wscript.exe `"$launcher`"" /sc onlogon /rl limited /f | Out-Null

# Start it now too, so you don't have to log out and back in.
Start-Process wscript.exe -ArgumentList "`"$launcher`""

Write-Host ""
Write-Host "Done. The bot now starts at logon and is running now."
Write-Host "Test it: message your bot /manage in Telegram."
Write-Host "To stop autostart: schtasks /delete /tn StockScreensaverBot /f"
