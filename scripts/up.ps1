<#
.SYNOPSIS
  Build (if needed) and start the full Vibe Accounting Malaysia stack.
#>
[CmdletBinding()]
param(
    [switch] $Build
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir  = Resolve-Path (Join-Path $ScriptDir "..\infra")

Push-Location $InfraDir
try {
    if ($Build) {
        Write-Host "[*] Building images..." -ForegroundColor Cyan
        docker compose build
    }
    Write-Host "[*] Starting containers..." -ForegroundColor Cyan
    docker compose up -d
    Write-Host ""
    Write-Host "[*] Status:" -ForegroundColor Cyan
    docker compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    Write-Host ""
    Write-Host "[OK] Stack is up at http://localhost:8080" -ForegroundColor Green
    Write-Host "     Swagger: http://localhost:8080/api/docs" -ForegroundColor Green
}
finally {
    Pop-Location
}
