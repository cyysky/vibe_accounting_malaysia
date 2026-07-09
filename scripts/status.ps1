<#
.SYNOPSIS
  Show status of the running stack and a snapshot of infra/data/ size.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir  = Resolve-Path (Join-Path $ScriptDir "..\infra")
$DataDir   = Join-Path $InfraDir "data"

Push-Location $InfraDir
try {
    Write-Host "=== Containers ===" -ForegroundColor Cyan
    docker compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1 | Out-String
}
finally {
    Pop-Location
}

if (Test-Path $DataDir) {
    Write-Host ""
    Write-Host "=== infra/data/ size ===" -ForegroundColor Cyan
    $subdirs = @("postgres", "uploads", "backups")
    foreach ($s in $subdirs) {
        $p = Join-Path $DataDir $s
        if (Test-Path $p) {
            $bytes = (Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue |
                      Measure-Object -Property Length -Sum).Sum
            Write-Host ("  {0,-10} {1,10:N2} MB" -f $s, ($bytes / 1MB))
        } else {
            Write-Host "  $s         (missing)"
        }
    }
} else {
    Write-Host ""
    Write-Host "infra/data/ does not exist yet." -ForegroundColor Yellow
}
