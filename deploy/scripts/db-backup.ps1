param(
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $projectRoot "deploy\backups"

if (-not (Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

if ([string]::IsNullOrWhiteSpace($OutputFile)) {
  $OutputFile = Join-Path $backupDir "db-backup-$timestamp.sql"
}

docker compose --env-file (Join-Path $projectRoot "deploy\.env") -f (Join-Path $projectRoot "docker-compose.yml") exec -T db sh -lc "pg_dump -U `"$POSTGRES_USER`" -d `"$POSTGRES_DB`"" | Set-Content -LiteralPath $OutputFile -Encoding UTF8

Write-Output "Backup created: $OutputFile"
