param(
  [switch]$SkipPostgres,
  [switch]$SkipMinio,
  [switch]$SkipDbInit
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $PSScriptRoot
$stateDir = Join-Path $repoRoot "tmp"
$stateFile = Join-Path $stateDir "local-dev-processes.json"
$composeFile = Join-Path $repoRoot "deploy\docker\docker-compose.local.yml"
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"

if (-not (Test-Path $stateDir)) {
  New-Item -ItemType Directory -Force $stateDir | Out-Null
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $windowCommand = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$WorkingDirectory'
$Command
"@

  return Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $windowCommand `
    -WindowStyle Normal `
    -PassThru
}

function Wait-PostgresHealthy {
  param(
    [string]$ContainerName,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $status = docker inspect -f "{{.State.Health.Status}}" $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") {
      return
    }

    Start-Sleep -Seconds 1
  }

  throw "PostgreSQL container did not become healthy within $TimeoutSeconds seconds."
}

function Wait-MinioHealthy {
  param(
    [string]$ContainerName,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $status = docker inspect -f "{{.State.Health.Status}}" $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") {
      return
    }

    Start-Sleep -Seconds 1
  }

  throw "MinIO container did not become healthy within $TimeoutSeconds seconds."
}

Write-Host "CQUPT-SRC local development startup" -ForegroundColor Green
Write-Host "Project: $repoRoot"

if (-not $SkipPostgres) {
  Write-Host "Starting PostgreSQL container..." -ForegroundColor Cyan
  docker compose -f $composeFile up -d postgres
  Write-Host "Waiting for PostgreSQL to become healthy..." -ForegroundColor Cyan
  Wait-PostgresHealthy -ContainerName "cqupt-src-local-postgres"
}

if (-not $SkipMinio) {
  Write-Host "Starting MinIO container..." -ForegroundColor Cyan
  docker compose -f $composeFile up -d minio
  Write-Host "Waiting for MinIO to become healthy..." -ForegroundColor Cyan
  Wait-MinioHealthy -ContainerName "cqupt-src-local-minio"
}

if (-not $SkipDbInit) {
  Write-Host "Applying database migrations..." -ForegroundColor Cyan
  Push-Location $backendDir
  try {
    npm.cmd run prisma:migrate:deploy
    npm.cmd run db:seed
  } finally {
    Pop-Location
  }
}

Write-Host "Starting backend dev server..." -ForegroundColor Cyan
$backendProcess = Start-DevWindow `
  -Title "CQUPT-SRC Backend" `
  -WorkingDirectory $backendDir `
  -Command "npm.cmd run dev"

Write-Host "Starting frontend dev server..." -ForegroundColor Cyan
$frontendProcess = Start-DevWindow `
  -Title "CQUPT-SRC Frontend" `
  -WorkingDirectory $frontendDir `
  -Command "npm.cmd run dev"

$state = [PSCustomObject]@{
  startedAt = (Get-Date).ToString("o")
  repoRoot = $repoRoot.Path
  composeFile = $composeFile
  postgres = [PSCustomObject]@{
    enabled = -not $SkipPostgres
    container = "cqupt-src-local-postgres"
  }
  minio = [PSCustomObject]@{
    enabled = -not $SkipMinio
    container = "cqupt-src-local-minio"
  }
  backend = [PSCustomObject]@{
    pid = $backendProcess.Id
    cwd = $backendDir
  }
  frontend = [PSCustomObject]@{
    pid = $frontendProcess.Id
    cwd = $frontendDir
  }
}

$state | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $stateFile

Write-Host ""
Write-Host "Startup commands have been launched." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3001/api/health"
Write-Host "Postgres: 127.0.0.1:15432"
Write-Host "MinIO:    http://localhost:9001"
Write-Host ""
Write-Host "To stop everything:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\stop-local.ps1"
