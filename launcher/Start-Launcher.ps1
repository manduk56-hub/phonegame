param([switch]$AutoPlay,[string]$SourceManifest='',[string]$InstallDirectory='',[string]$PreviewPath='')
$target=if($AutoPlay){'Start-InstalledGame.ps1'}else{'Start-Installer.ps1'}
$scriptPath=Join-Path $PSScriptRoot $target
$root=Split-Path -Parent $PSScriptRoot
# Older updaters copied only the original launcher scripts into the stable directory.
if(-not(Test-Path -LiteralPath $scriptPath) -and (Test-Path -LiteralPath (Join-Path $root 'installation.json'))){
    $installation=[IO.File]::ReadAllText((Join-Path $root 'installation.json'))|ConvertFrom-Json
    if($installation.app -ne 'playroom' -or $installation.version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$'){throw 'Invalid Playroom installation.'}
    $scriptPath=Join-Path $root ('versions/'+$installation.version+'/launcher/'+$target)
    if(-not $InstallDirectory){$InstallDirectory=$root}
}
& $scriptPath -SourceManifest $SourceManifest -InstallDirectory $InstallDirectory -PreviewPath $PreviewPath