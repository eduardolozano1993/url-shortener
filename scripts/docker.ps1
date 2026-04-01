[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("up", "down", "restart", "logs", "ps", "build", "reset")]
  [string]$Command = "up"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
$dockerExe = Join-Path $dockerBin "docker.exe"

if (-not (Test-Path $dockerExe)) {
  throw "Docker CLI not found at '$dockerExe'. Make sure Docker Desktop is installed."
}

if ($env:PATH -notlike "*$dockerBin*") {
  $env:PATH = "$dockerBin;$env:PATH"
}

$composeArgs = @("compose")

switch ($Command) {
  "up" {
    $composeArgs += @("up", "--build", "-d")
  }
  "down" {
    $composeArgs += @("down", "--remove-orphans")
  }
  "restart" {
    & $dockerExe @composeArgs down --remove-orphans
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
    $composeArgs += @("up", "--build", "-d")
  }
  "logs" {
    $composeArgs += @("logs", "-f")
  }
  "ps" {
    $composeArgs += @("ps")
  }
  "build" {
    $composeArgs += @("build")
  }
  "reset" {
    & $dockerExe @composeArgs down -v --remove-orphans
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
    $composeArgs += @("up", "--build", "-d")
  }
}

Push-Location $repoRoot
try {
  & $dockerExe @composeArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
