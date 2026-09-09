# SEVEN + CinePro launcher (Windows PowerShell)
# Starts CinePro Core (..\core) and a cloudflared quick tunnel, then prints the public URL.
#
# NOTE: quick-tunnel URLs change on every restart. This script handles everything:
#   1. Rewrites PUBLIC_URL in ..\core\.env and restarts Core.
#   2. Publishes the new URL to the owner's private GitHub gist, which SEVEN's
#      Pages Function reads for automatic discovery (no manual re-pinning).

$ErrorActionPreference = "SilentlyContinue"

$root    = Split-Path -Parent $PSScriptRoot          # cineva repo
$coreDir = Join-Path (Split-Path -Parent $root) "core"
$logDir  = Join-Path $env:TEMP "seven-cinepro"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Test-Path (Join-Path $coreDir "package.json"))) {
    Write-Host "CinePro Core not found at $coreDir" -ForegroundColor Red
    Write-Host "Run: git clone https://github.com/cinepro-org/core.git `"$coreDir`""
    exit 1
}

Write-Host "== Stopping previous instances ==" -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "== Starting cloudflared tunnel ==" -ForegroundColor Cyan
$tunnelLog = Join-Path $logDir "tunnel.log"
$cloudflared = (Get-Command cloudflared).Source
if (-not $cloudflared) { $cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://127.0.0.1:3000 --no-autoupdate" -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError (Join-Path $logDir "tunnel.err.log")

$url = $null
foreach ($i in 1..20) {
    Start-Sleep -Seconds 1
    $match = Select-String -Path $tunnelLog, (Join-Path $logDir "tunnel.err.log") -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($match) { $url = $match.Matches[0].Value; break }
}
if (-not $url) { Write-Host "Tunnel did not come up. Check $tunnelLog" -ForegroundColor Red; exit 1 }
Write-Host "Tunnel: $url" -ForegroundColor Green

Write-Host "== Publishing URL to SEVEN discovery gist ==" -ForegroundColor Cyan
$gistId = "1138dc488b4556454417bc2de1821ac2"
$gistFile = Join-Path $logDir "gist-body.json"
@{ files = @{ "cinepro.json" = @{ content = ('{"url":"' + $url + '"}') } } } | ConvertTo-Json -Depth 5 | Set-Content -Path $gistFile
gh api -X PATCH "gists/$gistId" --input "$gistFile" | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host "Discovery gist updated (SEVEN picks it up automatically)." -ForegroundColor Green }
else { Write-Host "Could not update gist (gh not logged in?). SEVEN may need the URL set manually in Account -> Playback." -ForegroundColor Yellow }

Write-Host "== Updating PUBLIC_URL and starting CinePro Core ==" -ForegroundColor Cyan
$envFile = Join-Path $coreDir ".env"
$envText = (Get-Content $envFile -Raw) -replace "(?m)^PUBLIC_URL=.*$", "PUBLIC_URL=`"$url`""
if ($envText -notmatch "PUBLIC_URL=") { $envText += "`nPUBLIC_URL=`"$url`"" }
Set-Content -Path $envFile -Value $envText -NoNewline

$coreLog = Join-Path $logDir "core.log"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory $coreDir -WindowStyle Hidden -RedirectStandardOutput $coreLog -RedirectStandardError (Join-Path $logDir "core.err.log")

foreach ($i in 1..60) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri "$url/v1" -TimeoutSec 5
        if ($health.status -eq "operational") { break }
    } catch {}
}

Write-Host ""
Write-Host "CinePro Core is live!" -ForegroundColor Green
Write-Host "  Public URL : $url"
Write-Host "  Health     : $url/v1"
Write-Host "  Core log   : $coreLog"
Write-Host ""
Write-Host "SEVEN discovers this URL automatically via the private gist - nothing to re-pin."
Write-Host "A personal override can still be set in SEVEN: Account -> Playback -> CinePro Core server."
Write-Host ""
Write-Host "Press Ctrl+C to stop (tunnel + core keep running until you close this PC or re-run this script)." -ForegroundColor Yellow
while ($true) { Start-Sleep -Seconds 60 }
