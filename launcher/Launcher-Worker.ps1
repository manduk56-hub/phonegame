param([Parameter(Mandatory)][string]$JobPath)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Launcher-Core.ps1')
$job = [IO.File]::ReadAllText($JobPath) | ConvertFrom-Json
try {
    $manifest = Get-ReleaseManifest -SourceManifest $job.sourceManifest
    if ($job.action -eq 'check') {
        Write-JobStatus $job.statusPath 'checked' ('다운로드 가능한 버전: ' + $manifest.version) @{manifest=$manifest}
    } elseif ($job.action -eq 'install') {
        Install-Playroom -Directory $job.directory -Manifest $manifest -StatusPath $job.statusPath
    } else { throw '지원하지 않는 작업입니다.' }
} catch {
    Write-JobStatus $job.statusPath 'error' $_.Exception.Message
    exit 1
}
