<#
.SYNOPSIS
  Restore a Vibe Accounting Malaysia backup.

.DESCRIPTION
  Stops the stack, extracts a backup archive (produced by backup.ps1) into
  infra/data, and restarts the stack. Pass -Prune to delete infra/data first
  so the restore is guaranteed to match the archive contents exactly.

.PARAMETER Archive
  Path to the .zip / .tar.gz backup file produced by backup.ps1.

.PARAMETER Prune
  If set, delete infra/data entirely before extracting. Default: $false
  (existing files are overwritten by archive entries; files added since the
  backup are kept).

.EXAMPLE
  .\scripts\restore.ps1 -Archive infra\data\backups\vibe-backup-2026-07-10.zip
  .\scripts\restore.ps1 -Archive .\my-snapshot.zip -Prune
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Archive,

    [switch] $Prune
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Resolve-Path (Join-Path $ScriptDir "..")
$InfraDir   = Join-Path $RepoRoot "infra"
$DataDir    = Join-Path $InfraDir "data"

if (-not (Test-Path $Archive)) {
    throw "Backup file not found: $Archive"
}

Write-Host "[*] Stopping stack..." -ForegroundColor Cyan
Push-Location $InfraDir
try {
    docker compose down 2>&1 | Out-String | Write-Host
} finally {
    Pop-Location
}

if ($Prune -and (Test-Path $DataDir)) {
    Write-Host "[*] Pruning existing infra/data (Postgres files, uploads, backups)..." -ForegroundColor Yellow
    Remove-Item -Path $DataDir -Recurse -Force
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

$stage = Join-Path $env:TEMP ("vibe-restore-stage-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage -Force | Out-Null

try {
    Write-Host "[*] Extracting $Archive ..." -ForegroundColor Cyan
    Expand-Archive -Path $Archive -DestinationPath $stage -Force

    Write-Host "[*] Copying extracted contents into $DataDir ..." -ForegroundColor Cyan
    robocopy $stage $DataDir /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null

    Write-Host "[*] Starting stack..." -ForegroundColor Cyan
    Push-Location $InfraDir
    try {
        docker compose up -d 2>&1 | Out-String | Write-Host
    } finally {
        Pop-Location
    }

    Write-Host "[OK] Restore complete." -ForegroundColor Green
}
finally {
    if (Test-Path $stage) { Remove-Item -Path $stage -Recurse -Force }
}
