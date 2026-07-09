<#
.SYNOPSIS
    Run end-to-end smoke tests against a running stack.

.DESCRIPTION
    Drives the API at http://localhost:8080 with the same checks as
    scripts/smoke.mjs.  Exits with non-zero on the first failure.

.EXAMPLE
    ./scripts/smoke.ps1
    ./scripts/smoke.ps1 -Host http://localhost:9090
#>
[CmdletBinding()]
param(
    [string]$Host = 'http://localhost:8080'
)

$ErrorActionPreference = 'Stop'
$env:SMOKE_HOST = $Host
node (Join-Path $PSScriptRoot 'smoke.mjs')
