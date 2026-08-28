[CmdletBinding()]
param(
  [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'reset')]
  [string]$Command = 'start',
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $RootDir '.env.docker.local'
$EnvTemplate = Join-Path $RootDir '.env.docker.example'
$ComposeFile = Join-Path $RootDir 'compose.yml'

Set-Location $RootDir

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) { throw "docker compose 执行失败，退出码：$LASTEXITCODE" }
}

function New-RandomHex([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

function Get-EnvValue([string]$Key) {
  $line = Get-Content $EnvFile | Where-Object { $_ -match "^$([Regex]::Escape($Key))=" } | Select-Object -First 1
  if ($null -eq $line) { return '' }
  return $line.Substring($line.IndexOf('=') + 1)
}

function Set-EnvValue([string]$Key, [string]$Value) {
  $lines = [Collections.Generic.List[string]](Get-Content $EnvFile)
  $index = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$([Regex]::Escape($Key))=") { $index = $i; break }
  }
  if ($index -ge 0) { $lines[$index] = "$Key=$Value" } else { $lines.Add("$Key=$Value") }
  [IO.File]::WriteAllLines($EnvFile, $lines, [Text.UTF8Encoding]::new($false))
}

function Initialize-Environment {
  if (-not (Test-Path $EnvFile)) {
    Copy-Item $EnvTemplate $EnvFile
    Write-Host "已创建本地配置：$EnvFile"
  }
  if (-not (Get-EnvValue 'POSTGRES_PASSWORD')) { Set-EnvValue 'POSTGRES_PASSWORD' (New-RandomHex 24) }
  if (-not (Get-EnvValue 'MINIO_ROOT_PASSWORD')) { Set-EnvValue 'MINIO_ROOT_PASSWORD' (New-RandomHex 24) }
  if (-not (Get-EnvValue 'JWT_ACCESS_SECRET')) { Set-EnvValue 'JWT_ACCESS_SECRET' (New-RandomHex 48) }
  if (-not (Get-EnvValue 'JWT_REFRESH_SECRET')) { Set-EnvValue 'JWT_REFRESH_SECRET' (New-RandomHex 48) }
  if (-not (Get-EnvValue 'ALTCHA_HMAC_SECRET')) { Set-EnvValue 'ALTCHA_HMAC_SECRET' (New-RandomHex 48) }
  if (-not (Get-EnvValue 'AI_CREDENTIAL_ENCRYPTION_KEY')) { Set-EnvValue 'AI_CREDENTIAL_ENCRYPTION_KEY' (New-RandomHex 32) }
  if (-not (Get-EnvValue 'NPM_REGISTRY')) { Set-EnvValue 'NPM_REGISTRY' 'https://registry.npmmirror.com' }
}

function Wait-ServiceHealth([string]$Service, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $containerId = (& docker compose --env-file $EnvFile -f $ComposeFile ps -q $Service).Trim()
    if ($containerId) {
      $status = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId 2>$null).Trim()
      if ($status -eq 'healthy') { return $true }
      if ($status -in @('exited', 'dead')) { return $false }
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

function Show-Summary {
  $frontendPort = Get-EnvValue 'FRONTEND_PORT'
  $backendPort = Get-EnvValue 'BACKEND_PORT'
  $minioPort = Get-EnvValue 'MINIO_CONSOLE_PORT'
  if (-not $frontendPort) { $frontendPort = '5173' }
  if (-not $backendPort) { $backendPort = '3001' }
  if (-not $minioPort) { $minioPort = '9001' }
  Write-Host "`n平台地址：http://localhost:$frontendPort"
  Write-Host "后端健康检查：http://localhost:$backendPort/api/health/live"
  Write-Host "MinIO 控制台：http://localhost:$minioPort"
  Write-Host "`n演示账号："
  Write-Host '  管理员  0000000 / admin123456+-'
  Write-Host '  审核员  0000001 / auditor123456+-'
  Write-Host '  用户    2025001 / 123456+-'
  Write-Host "`n查看日志：.\deploy-local.ps1 logs"
  Write-Host '停止服务：.\deploy-local.ps1 stop'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw '未安装 Docker。' }
& docker compose version *> $null
if ($LASTEXITCODE -ne 0) { throw '当前 Docker 未提供 Compose v2。' }
& docker ps *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop 未运行。' }
Initialize-Environment

switch ($Command) {
  'start' {
    Write-Host '正在构建并启动本地开发环境……'
    Invoke-Compose up -d --build
    if (-not ((Wait-ServiceHealth 'backend' 600) -and (Wait-ServiceHealth 'frontend' 300))) {
      Invoke-Compose ps
      throw '后端或前端未在规定时间内就绪，请运行 .\deploy-local.ps1 logs 查看原因。'
    }
    Write-Host '平台服务已就绪。'
    if (Wait-ServiceHealth 'clamav' 300) {
      Write-Host '文件安全扫描服务已就绪。'
    } else {
      Write-Warning '平台已可访问，安全扫描服务仍在初始化；初始化完成前暂不可上传文件。'
    }
    Show-Summary
  }
  'stop' { Invoke-Compose down --remove-orphans }
  'restart' { Invoke-Compose restart }
  'status' { Invoke-Compose ps }
  'logs' { Invoke-Compose logs --follow --tail=200 @Services }
  'reset' {
    Write-Warning '此操作会永久删除本地数据库、对象存储、Redis、病毒库缓存和依赖卷。'
    if ((Read-Host '第一次确认：输入 RESET 继续') -ne 'RESET') { Write-Host '已取消。'; break }
    if ((Read-Host '第二次确认：再次输入 DELETE LOCAL DATA') -ne 'DELETE LOCAL DATA') { Write-Host '已取消。'; break }
    Invoke-Compose down --volumes --remove-orphans
    Write-Host '本地 Docker 数据已删除。下次启动将重新初始化。'
  }
}
