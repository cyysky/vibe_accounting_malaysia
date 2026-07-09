<#
.SYNOPSIS
  Snapshot Vibe Accounting Malaysia persistent data.

.DESCRIPTION
  Produces a single .zip under infra/data/backups/ that contains the
  Postgres data files, uploaded files, and previous backups. Use this before
  upgrades, destructive ops, or as a periodic snapshot.

.PARAMETER OutFile
  Backup filename. Defaults to vibe-backup-yyyy-MM-dd-HHmmss.zip inside
  infra/data/backups.

.EXAMPLE
  .\scripts\backup.ps1
  .\scripts\backup.ps1 -OutFile before-upgrade.zip
#>
[CmdletBinding()]
param(
    [string] $OutFile = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Resolve-Path (Join-Path $ScriptDir "..")
$InfraDir    = Join-Path $RepoRoot "infra"
$DataDir     = Join-Path $InfraDir "data"
$BackupsDir  = Join-Path $DataDir "backups"

if (-not (Test-Path $DataDir)) {
    throw "Data directory not found at $DataDir. Has the stack ever been started?"
}

if (-not $OutFile) {
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $OutFile = "vibe-backup-$stamp.zip"
}
$OutFile = Join-Path $BackupsDir $OutFile

if (-not (Test-Path $BackupsDir)) {
    New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null
}

$stage = Join-Path $env:TEMP ("vibe-backup-stage-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage -Force | Out-Null

try {
    Write-Host "[*] Copying infra/data into staging area..." -ForegroundColor Cyan
    robocopy $DataDir $stage /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null

    Write-Host "[*] Creating archive: $OutFile" -ForegroundColor Cyan
    $sourceContents = Get-ChildItem -Path $stage -Force
    Compress-Archive -Path $sourceContents.FullName -DestinationPath $OutFile -CompressionLevel Optimal

    $size = (Get-Item $OutFile).Length
    Write-Host "[OK] Backup written: $OutFile ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Green
}
finally {
    if (Test-Path $stage) { Remove-Item -Path $stage -Recurse -Force }
}
