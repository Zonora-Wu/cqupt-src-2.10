param(
  [switch]$KeepPostgres,
  [switch]$KeepMinio
)

$ErrorActionPreference = "Continue"

$repoRoot = Resolve-Path $PSScriptRoot
$stateFile = Join-Path $repoRoot "tmp\local-dev-processes.json"
$composeFile = Join-Path $repoRoot "deploy\docker\docker-compose.local.yml"

function Stop-ProcessTree {
  param([int]$ProcessId)

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) {
    return
  }

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "CQUPT-SRC local development shutdown" -ForegroundColor Green

if (Test-Path $stateFile) {
  $state = Get-Content -Raw $stateFile | ConvertFrom-Json

  if ($state.frontend.pid) {
    Write-Host "Stopping frontend process tree: $($state.frontend.pid)" -ForegroundColor Cyan
    Stop-ProcessTree -ProcessId ([int]$state.frontend.pid)
  }

  if ($state.backend.pid) {
    Write-Host "Stopping backend process tree: $($state.backend.pid)" -ForegroundColor Cyan
    Stop-ProcessTree -ProcessId ([int]$state.backend.pid)
  }

  Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "No process state file found. Skipping frontend/backend PID cleanup." -ForegroundColor Yellow
}

Write-Host "Checking for leftover project Node processes..." -ForegroundColor Cyan
$escapedRepoRoot = [regex]::Escape($repoRoot.Path)
$leftoverProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -match $escapedRepoRoot -and
    ($_.CommandLine -match "\\backend\\" -or $_.CommandLine -match "\\frontend\\")
  }

foreach ($process in $leftoverProcesses) {
  Write-Host "Stopping leftover process: $($process.ProcessId)" -ForegroundColor Cyan
  Stop-ProcessTree -ProcessId ([int]$process.ProcessId)
}

if (-not $KeepPostgres) {
  Write-Host "Stopping PostgreSQL container..." -ForegroundColor Cyan
  docker compose -f $composeFile stop postgres
} else {
  Write-Host "Keeping PostgreSQL container running." -ForegroundColor Yellow
}

if (-not $KeepMinio) {
  Write-Host "Stopping MinIO container..." -ForegroundColor Cyan
  docker compose -f $composeFile stop minio
} else {
  Write-Host "Keeping MinIO container running." -ForegroundColor Yellow
}

Write-Host "Local development services stopped." -ForegroundColor Green
