param([string]$ServerUrl = '')
$ErrorActionPreference = 'Stop'
if (-not $PSBoundParameters.ContainsKey('ServerUrl')) {
    & (Join-Path $PSScriptRoot 'launcher/Start-InstalledGame.ps1')
    return
}
$previousKey = $env:DIRT_RALLY_HOST_KEY
$previousUrl = $env:DIRT_RALLY_SERVER_URL
try {
    . (Join-Path $PSScriptRoot 'Remote-Credentials.ps1')
    $ServerUrl = Get-RemoteServerUrl -ServerUrl $ServerUrl
    if (-not $ServerUrl) { return }
    & (Join-Path $PSScriptRoot 'Start-Game.ps1') -ServerUrl $ServerUrl
    Save-RemoteServerUrl -ServerUrl $ServerUrl
} finally {
    $env:DIRT_RALLY_HOST_KEY = $previousKey
    $env:DIRT_RALLY_SERVER_URL = $previousUrl
}
