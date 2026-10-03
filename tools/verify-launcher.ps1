$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$previousLocation = Get-Location
$previousLocalAppData = $env:LOCALAPPDATA
$testLocalAppData = Join-Path $projectDir ('.runtime/launcher-' + [Guid]::NewGuid().ToString('N'))
$env:LOCALAPPDATA = $testLocalAppData
$savedEnvironment = @{}
foreach ($name in @('DIRT_RALLY_SERVER_URL', 'DIRT_RALLY_HOST_KEY', 'GODOT_EXE')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$launches = [Collections.Generic.List[object]]::new()
$choices = [Collections.Generic.Queue[string]]::new()
$sourceVersion = (Get-FileHash (Join-Path $projectDir 'server.mjs') -Algorithm SHA256).Hash.ToLowerInvariant()
function Invoke-RestMethod {
    param($Uri, $TimeoutSec)
    return @{app='dirt-rally'; protocol=1; hostAuth='token'; sourceVersion=$sourceVersion}
}
function Start-Process {
    param($FilePath, $ArgumentList, $WindowStyle, [switch]$PassThru)
    $launches.Add(@{url=$env:DIRT_RALLY_SERVER_URL; key=$env:DIRT_RALLY_HOST_KEY; file=$FilePath})
    return @{Id=12345}
}
function Read-Host {
    param($Prompt, [switch]$AsSecureString)
    if ($AsSecureString) { throw 'Unexpected credential prompt in launcher verification.' }
    return $choices.Dequeue()
}
function Assert-Launch($ExpectedUrl, $ExpectedKey) {
    if ($launches.Count -ne 1) { throw "Expected one game launch, got $($launches.Count)." }
    if ([string]$launches[0].url -ne $ExpectedUrl -or [string]$launches[0].key -ne $ExpectedKey) {
        throw 'Game received the wrong connection environment.'
    }
    if ($env:DIRT_RALLY_SERVER_URL -ne 'https://inherited.example' -or $env:DIRT_RALLY_HOST_KEY -ne 'launcher-test-placeholder') {
        throw 'Launcher did not restore the parent connection environment.'
    }
    $launches.Clear()
}
try {
    $env:GODOT_EXE = (Get-Command node -ErrorAction Stop).Source
    $env:DIRT_RALLY_SERVER_URL = 'https://inherited.example'
    $env:DIRT_RALLY_HOST_KEY = 'launcher-test-placeholder'
    $launcher = Join-Path $projectDir 'Start-Playroom.ps1'
    & $launcher -Mode Local
    Assert-Launch '' ''
    & $launcher -Mode Server -ServerUrl 'https://chosen.example'
    Assert-Launch 'https://chosen.example' 'launcher-test-placeholder'
    $choices.Enqueue('bad'); $choices.Enqueue('1')
    & $launcher -Mode Ask
    Assert-Launch '' ''
    $choices.Enqueue('2')
    & $launcher -Mode Ask
    Assert-Launch 'https://chosen.example' 'launcher-test-placeholder'
    Remove-Item -LiteralPath (Join-Path $testLocalAppData 'DirtRally/server.json')
    $choices.Enqueue('2'); $choices.Enqueue(''); $choices.Enqueue('http://invalid.example'); $choices.Enqueue('https://personal.example/')
    & $launcher -Mode Ask
    Assert-Launch 'https://personal.example' 'launcher-test-placeholder'
    & (Join-Path $projectDir 'Start-RemoteGame.ps1') -ServerUrl ''
    Assert-Launch 'https://personal.example' 'launcher-test-placeholder'
    Remove-Item -LiteralPath (Join-Path $testLocalAppData 'DirtRally/server.json')
    $choices.Enqueue('2'); $choices.Enqueue('q')
    & $launcher -Mode Ask
    if ($launches.Count) { throw 'Cancelling server address entry started a game.' }
    $choices.Enqueue('q')
    & $launcher -Mode Ask
    if ($launches.Count) { throw 'Cancel started a game.' }
    Write-Host 'PASS: local override, own-server entry and persistence, invalid URLs, cancel and parent environment restoration. No game or server was started.'
} finally {
    $env:LOCALAPPDATA = $previousLocalAppData
    $testSettings = Join-Path $testLocalAppData 'DirtRally/server.json'
    if (Test-Path -LiteralPath $testSettings) { Remove-Item -LiteralPath $testSettings }
    if (Test-Path -LiteralPath (Join-Path $testLocalAppData 'DirtRally')) { Remove-Item -LiteralPath (Join-Path $testLocalAppData 'DirtRally') }
    if (Test-Path -LiteralPath $testLocalAppData) { Remove-Item -LiteralPath $testLocalAppData }
    foreach ($name in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
    Set-Location $previousLocation
}
