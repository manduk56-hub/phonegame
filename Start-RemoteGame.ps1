param([string]$ServerUrl = 'https://dirt-rally.115.68.208.145.sslip.io')
$ErrorActionPreference = 'Stop'
$previousKey = $env:DIRT_RALLY_HOST_KEY
$previousUrl = $env:DIRT_RALLY_SERVER_URL
try {
    $keyPath = Join-Path $PSScriptRoot '.runtime/remote-host-key'
    if (-not $env:DIRT_RALLY_HOST_KEY -and (Test-Path -LiteralPath $keyPath)) {
        $env:DIRT_RALLY_HOST_KEY = [IO.File]::ReadAllText($keyPath).Trim()
    }
    & (Join-Path $PSScriptRoot 'Start-Game.ps1') -ServerUrl $ServerUrl
} finally {
    $env:DIRT_RALLY_HOST_KEY = $previousKey
    $env:DIRT_RALLY_SERVER_URL = $previousUrl
}
