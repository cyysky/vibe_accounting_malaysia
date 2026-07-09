<#
.SYNOPSIS
  DESTRUCTIVE: stop the stack and wipe infra/data/.

.DESCRIPTION
  Removes all containers AND the persistent host data directory. Use this
  for a clean local reset before re-running from scratch.

  Tip: run backup.ps1 first if you might want to restore.
#>
[CmdletBinding()]
param(
    [switch] $Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..")
$InfraDir  = Join-Path $RepoRoot "infra"
$DataDir   = Join-Path $InfraDir "data"

if (-not $Force) {
    Write-Warning "This will DELETE infra/data/ (Postgres files, uploads, backups)."
    $ans = Read-Host "Type 'yes' to continue"
    if ($ans -ne "yes") {
        Write-Host "Aborted." -ForegroundColor Yellow
        return
    }
}

Push-Location $InfraDir
try {
    docker compose down -v 2>&1 | Out-Null
} finally {
    Pop-Location
}

if (Test-Path $DataDir) {
    Write-Host "[*] Removing $DataDir ..." -ForegroundColor Cyan
    Remove-Item -Path $DataDir -Recurse -Force
}
# Re-create the skeleton + .gitignore + .gitkeep placeholders so the repo
# tree stays consistent after reset.
New-Item -ItemType Directory -Path "$DataDir\postgres" -Force | Out-Null
New-Item -ItemType Directory -Path "$DataDir\uploads"  -Force | Out-Null
New-Item -ItemType Directory -Path "$DataDir\backups"  -Force | Out-Null
Set-Content -Path "$DataDir\.gitignore" -Value "*`n!.gitignore`n!.gitkeep`n"
New-Item -ItemType File -Path "$DataDir\uploads\.gitkeep" -Force | Out-Null
New-Item -ItemType File -Path "$DataDir\backups\.gitkeep" -Force | Out-Null

Write-Host "[OK] Stack stopped, infra/data/ wiped." -ForegroundColor Green
Write-Host "    Run scripts/up.ps1 to start fresh." -ForegroundColor Green
