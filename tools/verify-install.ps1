param([string]$ManifestPath='')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot 'launcher/Launcher-Core.ps1')
if(-not $ManifestPath){$ManifestPath=Join-Path $projectRoot '.runtime/releases/playroom-manifest.json'}
$testRoot=Join-Path $projectRoot ('.runtime/install-test-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot)|Out-Null
$previousProfile=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path $testRoot 'profile'
$destination=Join-Path $testRoot 'game with spaces'
$statusPath=Join-Path $testRoot 'status.json'
function Assert($Condition,[string]$Message){if(-not $Condition){throw $Message}}
try{
    $manifest=Get-ReleaseManifest $ManifestPath
    Install-Playroom -Directory $destination -Manifest $manifest -StatusPath $statusPath -SkipShortcut
    $installed=Get-Installation $destination
    Assert ($installed.version -eq $manifest.version) 'Incorrect installed version.'
    Assert (Test-Path -LiteralPath (Join-Path $destination 'launcher/Start-Launcher.ps1')) 'Stable launcher missing.'
    Install-Playroom -Directory $destination -Manifest $manifest -StatusPath $statusPath -SkipShortcut
    Assert ((Compare-PlayroomVersion '0.2.1' '0.2.0') -gt 0) 'Version comparison failed.'
    Assert ((Compare-PlayroomVersion '0.2.1' '0.2.1-beta.2') -gt 0) 'Stable version ordering failed.'
    Assert ((Compare-PlayroomVersion '0.2.1-beta.10' '0.2.1-beta.2') -gt 0) 'Prerelease ordering failed.'
    $bad=$manifest|ConvertTo-Json|ConvertFrom-Json
    $bad.version='99.0.0';$bad.sha256='0'*64
    $rejected=$false
    try{Install-Playroom -Directory $destination -Manifest $bad -StatusPath $statusPath -SkipShortcut}catch{$rejected=$true}
    Assert $rejected 'Corrupt archive was accepted.'
    Assert ((Get-Installation $destination).version -eq $manifest.version) 'Failed update damaged the installed version.'
    $foreign=Join-Path $testRoot 'other-app'
    [IO.Directory]::CreateDirectory($foreign)|Out-Null
    [IO.File]::WriteAllText((Join-Path $foreign 'keep.txt'),'other app')
    $rejected=$false
    try{Install-Playroom -Directory $foreign -Manifest $manifest -StatusPath $statusPath -SkipShortcut}catch{$rejected=$true}
    Assert $rejected 'Non-Playroom folder was adopted.'
    Assert ([IO.File]::ReadAllText((Join-Path $foreign 'keep.txt')) -eq 'other app') 'Existing file was altered.'
    $malicious=Join-Path $testRoot 'malicious.zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::Open($malicious,[IO.Compression.ZipArchiveMode]::Create)
    try{$entry=$zip.CreateEntry('../escape.txt');$writer=[IO.StreamWriter]::new($entry.Open());$writer.Write('bad');$writer.Dispose()}finally{$zip.Dispose()}
    $rejected=$false
    try{Expand-CheckedArchive $malicious (Join-Path $testRoot 'extract')}catch{$rejected=$true}
    Assert $rejected 'Archive path traversal was accepted.'
    Assert (-not(Test-Path -LiteralPath (Join-Path $testRoot 'escape.txt'))) 'Archive escaped the install directory.'
    # Make a newer package from the verified package, with matching release metadata.
    $updateFiles=Join-Path $testRoot 'update-files'
    Expand-CheckedArchive (Join-Path $manifest.sourceDirectory $manifest.fileName) $updateFiles
    [IO.File]::WriteAllText((Join-Path $updateFiles 'release.json'),'{"app":"playroom","version":"99.0.0"}')
    $updateArchive=Join-Path $testRoot 'playroom-99.0.0-windows-x64.zip'
    Compress-Archive -Path (Join-Path $updateFiles '*') -DestinationPath $updateArchive
    $new=@{app='playroom';formatVersion=1;version='99.0.0';fileName='playroom-99.0.0-windows-x64.zip';sha256=(Get-FileHash $updateArchive -Algorithm SHA256).Hash.ToLowerInvariant()}
    $newManifest=Join-Path $testRoot 'update-manifest.json'
    [IO.File]::WriteAllText($newManifest,($new|ConvertTo-Json))
    Install-Playroom -Directory $destination -Manifest (Get-ReleaseManifest $newManifest) -StatusPath $statusPath -SkipShortcut
    Assert ((Get-Installation $destination).version -eq '99.0.0') 'New version did not activate.'
    Assert (Test-Path -LiteralPath (Join-Path $destination ('versions/'+$manifest.version))) 'Previous version was not retained.'
    Write-Host 'PASS: real package install and update, stable launcher, checksum rejection, existing folder protection, version ordering and archive traversal rejection.'
}finally{
    $env:LOCALAPPDATA=$previousProfile
    $resolved=[IO.Path]::GetFullPath($testRoot)
    $allowed=[IO.Path]::GetFullPath((Join-Path $projectRoot '.runtime')).TrimEnd('\')+'\'
    if($resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'install-test-*'){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
