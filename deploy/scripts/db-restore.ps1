param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedInput = Resolve-Path $InputFile

Get-Content -LiteralPath $resolvedInput | docker compose --env-file (Join-Path $projectRoot "deploy\.env") -f (Join-Path $projectRoot "docker-compose.yml") exec -T db sh -lc "psql -U `"$POSTGRES_USER`" -d `"$POSTGRES_DB`""

Write-Output "Restore completed from: $resolvedInput"
