<#
.SYNOPSIS
  Stop the Vibe Accounting Malaysia stack.

.PARAMETER Volumes
  If set, also remove the (now-unused) anonymous volumes. Note: persistent
  data lives on the host under infra/data/ and is NOT affected by this flag.
#>
[CmdletBinding()]
param(
    [switch] $Volumes
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir  = Resolve-Path (Join-Path $ScriptDir "..\infra")

Push-Location $InfraDir
try {
    if ($Volumes) {
        docker compose down -v
    } else {
        docker compose down
    }
    Write-Host "[OK] Stack stopped. Persistent data in infra/data/ is intact." -ForegroundColor Green
}
finally {
    Pop-Location
}
