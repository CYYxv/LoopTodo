param(
  [string]$AdbPath = "H:\Android\Sdk\platform-tools\adb.exe",
  [string]$PackageName = "com.looptodo.app",
  [string]$OutputRoot = "H:\LoopTodo\runtime"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $AdbPath)) {
  throw "ADB not found: $AdbPath"
}

$devices = & $AdbPath devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
if (@($devices).Count -ne 1) {
  throw "Exactly one authorized Android device is required. Found: $(@($devices).Count)"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDirectory = Join-Path $OutputRoot "focus-audit-$timestamp"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

& $AdbPath shell am force-stop $PackageName | Out-Null

$databaseName = "looptodo.db"
$databaseCandidates = @("files/SQLite/$databaseName", "databases/$databaseName")
$databasePathOnDevice = $null
foreach ($candidate in $databaseCandidates) {
  & $AdbPath shell run-as $PackageName test -f $candidate
  if ($LASTEXITCODE -eq 0) {
    $databasePathOnDevice = $candidate
    break
  }
}
if (-not $databasePathOnDevice) {
  throw "Unable to locate $databaseName in the supported Expo SQLite or Android database directories."
}

$databaseDirectory = $databasePathOnDevice.Substring(0, $databasePathOnDevice.LastIndexOf('/'))
$deviceFiles = @($databaseName, "$databaseName-wal", "$databaseName-shm")
foreach ($deviceFile in $deviceFiles) {
  $destination = Join-Path $outputDirectory $deviceFile
  $process = Start-Process -FilePath $AdbPath -ArgumentList @(
    "exec-out", "run-as", $PackageName, "cat", "$databaseDirectory/$deviceFile"
  ) -RedirectStandardOutput $destination -RedirectStandardError "$destination.error" -NoNewWindow -Wait -PassThru

  if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $destination) -or (Get-Item -LiteralPath $destination).Length -eq 0) {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath "$destination.error" -Force -ErrorAction SilentlyContinue
}

$databasePath = Join-Path $outputDirectory $databaseName
if (-not (Test-Path -LiteralPath $databasePath)) {
  throw "Unable to export $databaseName. Confirm this is a debuggable Development Build and the package is installed."
}
$stream = [System.IO.File]::OpenRead($databasePath)
try {
  $header = New-Object byte[] 16
  $bytesRead = $stream.Read($header, 0, $header.Length)
} finally {
  $stream.Dispose()
}
$sqliteHeader = if ($bytesRead -eq 16) { [System.Text.Encoding]::ASCII.GetString($header) } else { '' }
if ($sqliteHeader -ne "SQLite format 3`0") {
  throw "Exported file does not have a valid SQLite header. Device path: $databasePathOnDevice"
}

$auditScript = Join-Path $PSScriptRoot "audit-focus-database.py"
& python $auditScript $databasePath --output $outputDirectory
if ($LASTEXITCODE -ne 0) {
  throw "Database audit failed with exit code $LASTEXITCODE"
}

Write-Host "Database backup and reports: $outputDirectory"
