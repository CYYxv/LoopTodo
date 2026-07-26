param(
  [int]$DatabasePort = 57432,
  [int]$ApiPort = 3310,
  [int]$StudioPort = 5755,
  [int]$MetroPort = 8381,
  [int]$RewardAdminPort = 4373
)

$ErrorActionPreference = 'Stop'

$repo = 'H:\LoopTodo-worktrees\release-apk'
$apiDirectory = Join-Path $repo 'apps\api'
$mobileDirectory = Join-Path $repo 'apps\mobile'
$runtime = 'H:\LoopTodo\runtime'
$postgresBin = 'G:\PostgreSQL\17\bin'
$postgresData = Join-Path $runtime 'postgres-data'
$databaseUrl = "postgresql://looptodo@localhost:$DatabasePort/looptodo"

New-Item -ItemType Directory -Path $runtime -Force | Out-Null

function Test-ListeningPort([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Test-PostgresDataServerRunning {
  & (Join-Path $postgresBin 'pg_ctl.exe') -D $postgresData status *> $null
  return $LASTEXITCODE -eq 0
}

function Wait-PostgresReady([int]$timeoutSeconds = 300) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  do {
    & (Join-Path $postgresBin 'pg_isready.exe') -h 127.0.0.1 -p $DatabasePort -U looptodo -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Test-LanListeningPort([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Where-Object {
    $_.LocalAddress -notin @('127.0.0.1', '::1')
  } | Select-Object -First 1)
}

function Test-LoopbackOnlyListeningPort([int]$port) {
  $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
  return $connections.Count -gt 0 -and -not ($connections | Where-Object {
    $_.LocalAddress -notin @('127.0.0.1', '::1')
  } | Select-Object -First 1)
}

function Test-HttpEndpoint([string]$uri, [string]$expectedText) {
  try {
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2
    $content = if ($response.Content -is [byte[]]) {
      [System.Text.Encoding]::UTF8.GetString($response.Content)
    } else {
      [string]$response.Content
    }
    return $response.StatusCode -eq 200 -and $content -like "*$expectedText*"
  } catch {
    return $false
  }
}

function Test-RequiredServicesReady {
  return (Test-ListeningPort $ApiPort) -and
    (Test-HttpEndpoint "http://127.0.0.1:$ApiPort/" 'LoopTodo API') -and
    (Test-LoopbackOnlyListeningPort $StudioPort) -and
    (Test-HttpEndpoint "http://127.0.0.1:$StudioPort/" 'Prisma Studio') -and
    (Test-LanListeningPort $MetroPort) -and
    (Test-HttpEndpoint "http://127.0.0.1:$MetroPort/status" 'packager-status:running') -and
    (Test-ListeningPort $RewardAdminPort) -and
    (Test-HttpEndpoint "http://127.0.0.1:$RewardAdminPort/" 'LoopTodo')
}

function Get-PortOwnerProcesses([int]$port) {
  $processIds = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
  if ($processIds.Count -eq 0) { return @() }

  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -in $processIds
  })
}

function Test-LoopTodoPortOwner([int]$port) {
  $owners = @(Get-PortOwnerProcesses $port)
  if ($owners.Count -eq 0) { return $false }

  $allProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  $byId = @{}
  foreach ($process in $allProcesses) { $byId[[int]$process.ProcessId] = $process }

  foreach ($owner in $owners) {
    $current = $owner
    for ($depth = 0; $depth -lt 12 -and $current; $depth++) {
      $identity = "$($current.ExecutablePath) $($current.CommandLine)"
      if ($identity -like "*$repo*" -or $identity -like "*$runtime*") { return $true }
      $parentId = [int]$current.ParentProcessId
      $current = if ($byId.ContainsKey($parentId)) { $byId[$parentId] } else { $null }
    }
  }
  return $false
}

function Assert-PortAvailableOrLoopTodo([string]$serviceName, [int]$port) {
  if (-not (Test-ListeningPort $port) -or (Test-LoopTodoPortOwner $port)) { return }

  $owners = @(Get-PortOwnerProcesses $port | ForEach-Object {
    "PID $($_.ProcessId) $($_.Name): $($_.CommandLine)"
  })
  throw "$serviceName port $port is already used by another project. LoopTodo did not stop it. Owner: $($owners -join ' | ')"
}

function Get-WatchmanDirectory {
  $command = Get-Command watchman.exe -ErrorAction SilentlyContinue
  if ($command) { return Split-Path -Parent $command.Source }

  $packageRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  $watchman = Get-ChildItem $packageRoot -Recurse -Filter watchman.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like '*facebook.watchman*' } |
    Select-Object -First 1
  if ($watchman) { return $watchman.DirectoryName }
  return $null
}

function Start-HiddenPowerShell([string]$serviceName, [string]$script) {
  $scriptPath = Join-Path $runtime "start-$serviceName.ps1"
  Set-Content -LiteralPath $scriptPath -Value $script -Encoding utf8
  return Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$scriptPath`"" -WindowStyle Hidden -PassThru
}

function Test-StartedProcessExited($process) {
  if (-not $process) { return $false }
  $process.Refresh()
  return $process.HasExited
}

function Test-LoopTodoMetroProcessRunning {
  return [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*$mobileDirectory*" -and
    $_.CommandLine -like '*expo*start*' -and
    $_.CommandLine -like "*--port $MetroPort*"
  } | Select-Object -First 1)
}

function Get-LocalDevelopmentIp {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254*' -and
      $_.IPAddress -notlike '198.18.*'
    }
  $private = $addresses | Where-Object {
    $_.IPAddress -like '192.168.*' -or
    $_.IPAddress -like '10.*' -or
    $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[01])\.'
  } | Select-Object -First 1
  if ($private) { return $private.IPAddress }
  return ($addresses | Select-Object -First 1).IPAddress
}

function Ensure-FirewallPort([string]$name, [int]$port) {
  try {
    if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress LocalSubnet -Profile Any | Out-Null
    }
  } catch {
    Write-Warning "Could not add firewall rule $name. Run this script as Administrator if phone access fails."
  }
}

Write-Host 'Starting LoopTodo development services...' -ForegroundColor Cyan

Assert-PortAvailableOrLoopTodo 'PostgreSQL' $DatabasePort
Assert-PortAvailableOrLoopTodo 'API' $ApiPort
Assert-PortAvailableOrLoopTodo 'Prisma Studio' $StudioPort
Assert-PortAvailableOrLoopTodo 'Metro' $MetroPort
Assert-PortAvailableOrLoopTodo 'Reward Admin' $RewardAdminPort

$localIp = Get-LocalDevelopmentIp
$corsOrigins = "http://127.0.0.1:$RewardAdminPort,http://localhost:$RewardAdminPort,http://$localIp`:$RewardAdminPort"

if ((Test-ListeningPort $StudioPort) -and -not (Test-LoopbackOnlyListeningPort $StudioPort)) {
  throw "Prisma Studio port $StudioPort is listening beyond localhost. Close the old LoopTodo Studio process and run this script again; the launcher will not stop it automatically."
}

$occupiedHealthChecks = @(
  @{ Name = 'API'; Port = $ApiPort; Uri = "http://127.0.0.1:$ApiPort/"; Expected = 'LoopTodo API' },
  @{ Name = 'Prisma Studio'; Port = $StudioPort; Uri = "http://127.0.0.1:$StudioPort/"; Expected = 'Prisma Studio' },
  @{ Name = 'Metro'; Port = $MetroPort; Uri = "http://127.0.0.1:$MetroPort/status"; Expected = 'packager-status:running' },
  @{ Name = 'Reward Admin'; Port = $RewardAdminPort; Uri = "http://127.0.0.1:$RewardAdminPort/"; Expected = 'LoopTodo' }
)
foreach ($check in $occupiedHealthChecks) {
  if ((Test-ListeningPort $check.Port) -and -not (Test-HttpEndpoint $check.Uri $check.Expected)) {
    throw "$($check.Name) port $($check.Port) is held by a LoopTodo-path process, but its health response is unexpected."
  }
}

if (-not (Test-Path (Join-Path $postgresBin 'pg_ctl.exe'))) {
  throw "PostgreSQL was not found at $postgresBin"
}

if (-not (Test-Path (Join-Path $postgresData 'PG_VERSION'))) {
  & (Join-Path $postgresBin 'initdb.exe') -D $postgresData -U looptodo -A trust --encoding=UTF8 --no-locale
}

if (-not (Test-PostgresDataServerRunning)) {
  & (Join-Path $postgresBin 'pg_ctl.exe') -D $postgresData -l (Join-Path $runtime 'postgres.log') -o "`"-p $DatabasePort`"" start -w -t 300
  if ($LASTEXITCODE -ne 0 -and -not (Test-PostgresDataServerRunning)) {
    throw "LoopTodo PostgreSQL failed to start. Check $runtime\postgres.log."
  }
}

if (-not (Wait-PostgresReady 300)) {
  throw "LoopTodo PostgreSQL did not become ready within 5 minutes. Check $runtime\postgres.log."
}

function Test-ApiDependencies {
  if (-not (Test-Path (Join-Path $apiDirectory 'node_modules'))) { return $false }
  Push-Location $apiDirectory
  try {
    & node -e "require('rxjs'); require('fast-check')" *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    Pop-Location
  }
}

if (-not (Test-ApiDependencies)) {
  Write-Host 'API dependencies are missing or corrupted; reinstalling...' -ForegroundColor Yellow
  Push-Location $apiDirectory
  npm ci
  Pop-Location
}

$apiAlreadyRunning = Test-ListeningPort $ApiPort
Push-Location $apiDirectory
try {
  $env:DATABASE_URL = $databaseUrl
  if (-not $apiAlreadyRunning) {
    npx prisma generate | Out-Null
  }
  npx prisma migrate deploy | Out-Null
} finally {
  Pop-Location
}

Ensure-FirewallPort "LoopTodo API Local Network ($ApiPort)" $ApiPort
Ensure-FirewallPort "LoopTodo Metro Local Network ($MetroPort)" $MetroPort

Ensure-FirewallPort "LoopTodo Reward Admin Local Network ($RewardAdminPort)" $RewardAdminPort
$rewardAdminDir = Join-Path $repo 'apps\reward-admin'
$rewardAdminProcess = $null
if ((Test-Path (Join-Path $rewardAdminDir 'server.mjs')) -and -not (Test-ListeningPort $RewardAdminPort)) {
  $rewardScript = @"
Set-Location '$rewardAdminDir'
`$env:PORT='$RewardAdminPort'
node server.mjs *> '$runtime\reward-admin.log'
"@
  $rewardAdminProcess = Start-HiddenPowerShell 'reward-admin' $rewardScript
}


$apiProcess = $null
if (-not $apiAlreadyRunning) {
  $apiScript = @"
`$env:NODE_ENV='development'
`$env:PORT='$ApiPort'
`$env:CORS_ORIGINS='$corsOrigins'
`$env:DATABASE_URL='$databaseUrl'
`$env:REDIS_URL='redis://localhost:6379'
`$env:JWT_ACCESS_SECRET='local-development-access-secret-change-me'
`$env:JWT_REFRESH_SECRET='local-development-refresh-secret-change-me'
`$env:JWT_ACCESS_TTL_SECONDS='900'
`$env:JWT_REFRESH_TTL_SECONDS='2592000'
`$env:PAYMENT_PROVIDER='test'
`$env:PAYMENT_WEBHOOK_SECRET='local-development-payment-webhook-secret'
`$env:REWARD_ADDRESS_ENCRYPTION_KEY='local-development-reward-address-key'
`$env:ADMIN_EMAILS='admin@example.com'
Set-Location '$apiDirectory'
npm run dev *> '$runtime\api.log'
"@
  $apiProcess = Start-HiddenPowerShell 'api' $apiScript
}

$studioProcess = $null
if (-not (Test-ListeningPort $StudioPort)) {
  $studioScript = @"
`$env:DATABASE_URL='$databaseUrl'
Set-Location '$apiDirectory'
npx prisma studio --hostname 127.0.0.1 --port $StudioPort --browser none *> '$runtime\studio.log'
"@
  $studioProcess = Start-HiddenPowerShell 'studio' $studioScript
}

$metroAlreadyRunning = Test-LanListeningPort $MetroPort
$metroProcess = $null
if (-not $metroAlreadyRunning) {
  $watchmanDirectory = Get-WatchmanDirectory
  if (-not $watchmanDirectory) {
    throw 'Watchman is required for reliable Metro hot reload on Windows. Install it with: winget install --id facebook.watchman --exact'
  }
  $metroScript = @"
`$env:NODE_ENV='development'
`$env:PATH='$watchmanDirectory;' + `$env:PATH
Set-Location '$mobileDirectory'
npx expo start --dev-client --lan --port $MetroPort *> '$runtime\metro.log'
"@
  $metroProcess = Start-HiddenPowerShell 'metro' $metroScript
}

$deadline = (Get-Date).AddMinutes(20)
$lastWaitingMessage = Get-Date
do {
  Start-Sleep -Seconds 2
  $failedServices = @()
  if ((Test-StartedProcessExited $apiProcess) -and -not (Test-ListeningPort $ApiPort)) { $failedServices += 'API' }
  if ((Test-StartedProcessExited $studioProcess) -and -not (Test-ListeningPort $StudioPort)) { $failedServices += 'Studio' }
  if ((Test-StartedProcessExited $metroProcess) -and
      -not (Test-LanListeningPort $MetroPort) -and
      -not (Test-LoopTodoMetroProcessRunning)) { $failedServices += 'Metro' }
  if ($failedServices.Count -gt 0) {
    throw "LoopTodo services exited during startup: $($failedServices -join ', '). Check logs in $runtime."
  }
  if ((Test-StartedProcessExited $rewardAdminProcess) -and -not (Test-ListeningPort $RewardAdminPort)) {
    Write-Warning "Reward Admin exited during startup. Check $runtime\reward-admin.log."
    $rewardAdminProcess = $null
  }
  $ready = Test-RequiredServicesReady
  if (-not $ready -and ((Get-Date) - $lastWaitingMessage).TotalSeconds -ge 15) {
    $waitingFor = @()
    if (-not (Test-ListeningPort $ApiPort)) { $waitingFor += "API ($ApiPort)" }
    if (-not (Test-ListeningPort $StudioPort)) { $waitingFor += "Studio ($StudioPort)" }
    if (-not (Test-LanListeningPort $MetroPort)) { $waitingFor += "Metro LAN listener ($MetroPort)" }
    Write-Host "Still starting: $($waitingFor -join ', ')..." -ForegroundColor Yellow
    $lastWaitingMessage = Get-Date
  }
} until ($ready -or (Get-Date) -ge $deadline)

if (-not $ready) {
  Start-Sleep -Seconds 5
  $ready = Test-RequiredServicesReady
}
Write-Host ''
if (-not $ready) {
  Write-Error "LoopTodo services failed to start. Check $runtime\api.log, studio.log and metro.log."
  exit 1
}

Write-Host "API:         http://$localIp`:$ApiPort" -ForegroundColor Green
Write-Host "Studio:      http://127.0.0.1`:$StudioPort (local only)" -ForegroundColor Green
Write-Host "Metro:       http://$localIp`:$MetroPort" -ForegroundColor Green
Write-Host "RewardAdmin: http://$localIp`:$RewardAdminPort" -ForegroundColor Green
Write-Host "Latest APK: H:\LoopTodo\releases\current\LoopTodo-development-arm64-latest.apk" -ForegroundColor Green
Write-Host ''
Write-Host 'All LoopTodo development services are running.' -ForegroundColor Cyan
