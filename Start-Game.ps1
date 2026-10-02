$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeExe = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/ws'))) {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
}
$serverReady = $false
$responseReceived = $false
$expectedVersion = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'server.mjs') -Algorithm SHA256).Hash.ToLowerInvariant()
try {
    $config = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/config' -TimeoutSec 2
    $responseReceived = $true
    $serverReady = $config.app -eq 'dirt-rally' -and $config.protocol -eq 1
} catch { }
if ($responseReceived -and -not $serverReady) { throw 'Port 3000 is serving another app. Close it or choose another port before starting DIRT RALLY.' }
if ($serverReady -and $config.sourceVersion -ne $expectedVersion) {
    $serverOwner = Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serverOwner"
    if ($serverProcess.Name -ne 'node.exe' -or $serverProcess.CommandLine -notmatch 'server\.mjs') {
        throw 'The running DIRT RALLY server is outdated but its process could not be verified. Restart that server before launching the game.'
    }
    Stop-Process -Id $serverOwner
    $serverReady = $false
    Write-Host 'Restarting outdated DIRT RALLY server.'
}
if (-not $serverReady) {
    Start-Process -FilePath $nodeExe -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $config = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/config' -TimeoutSec 1
            $serverReady = $config.app -eq 'dirt-rally' -and $config.protocol -eq 1
            if ($serverReady) { break }
        } catch { }
        Start-Sleep -Milliseconds 100
    }
    if (-not $serverReady) { throw 'Game server did not start on port 3000' }
}
$runtimePath = Join-Path $PSScriptRoot '.runtime/godot'
$godotPath = $env:GODOT_EXE
if (-not $godotPath) {
    $godotExe = Get-ChildItem -LiteralPath $runtimePath -Filter '*.exe' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '*console*' } | Select-Object -First 1
    if ($godotExe) { $godotPath = $godotExe.FullName }
}
if ($godotPath -and (Test-Path -LiteralPath $godotPath)) {
    $gameProcess = Start-Process -FilePath $godotPath -ArgumentList @('--path', ('"' + (Join-Path $PSScriptRoot 'game') + '"')) -WindowStyle Normal -PassThru
    Write-Host ('Game PID: ' + $gameProcess.Id)
} else {
    Write-Host 'Open game/project.godot in Godot 4 and press F5.'
}
