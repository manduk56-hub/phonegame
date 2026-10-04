param([string]$Version='0.3.0',[string]$OutputDirectory='',[string]$GodotExe='',[string]$NodeExe='',[string]$CloudflaredExe='',[string]$GodotVersion='4.6.2')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Official-Downloads.ps1')
. (Join-Path $PSScriptRoot 'Release-Retention.ps1')
$projectRoot=Split-Path -Parent $PSScriptRoot
if($Version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$'){throw 'Version must be a semantic version.'}
if(-not $OutputDirectory){$OutputDirectory=Join-Path $projectRoot '.runtime/releases'}
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($OutputDirectory)|Out-Null
$cache=Join-Path $projectRoot '.runtime/build-cache'
[IO.Directory]::CreateDirectory($cache)|Out-Null
if(-not $GodotExe){
    $engineDirectory=Join-Path $cache ('godot-'+$GodotVersion)
    $GodotExe=Join-Path $engineDirectory ('Godot_v'+$GodotVersion+'-stable_win64_console.exe')
    if(-not(Test-Path -LiteralPath $GodotExe)){
        $zip=Join-Path $cache ('godot-'+$GodotVersion+'.zip')
        Get-OfficialGithubAsset 'godotengine/godot-builds' ('tags/'+$GodotVersion+'-stable') ('Godot_v'+$GodotVersion+'-stable_win64.exe.zip') $zip
        Expand-Archive -LiteralPath $zip -DestinationPath $engineDirectory -Force
    }
}
$engineVersion=(& $GodotExe --version|Select-Object -Last 1).Trim()
if($LASTEXITCODE -ne 0 -or $engineVersion -notmatch '^(\d+\.\d+\.\d+)\.stable\.'){throw 'A stable Godot editor is required.'}
$templateVersion=$Matches[1]
$templateDirectory=Join-Path $env:APPDATA ('Godot/export_templates/'+$templateVersion+'.stable')
if(-not(Test-Path -LiteralPath (Join-Path $templateDirectory 'windows_release_x86_64.exe'))){
    $tpz=Join-Path $cache ('templates-'+$templateVersion+'.zip')
    Get-OfficialGithubAsset 'godotengine/godot-builds' ('tags/'+$templateVersion+'-stable') ('Godot_v'+$templateVersion+'-stable_export_templates.tpz') $tpz
    $extract=Join-Path $cache ('templates-'+$templateVersion)
    Expand-Archive -LiteralPath $tpz -DestinationPath $extract -Force
    [IO.Directory]::CreateDirectory($templateDirectory)|Out-Null
    foreach($name in @('windows_release_x86_64.exe','version.txt')){Copy-Item -LiteralPath (Join-Path $extract "templates/$name") -Destination $templateDirectory -Force}
}
if(-not $NodeExe){$NodeExe=(Get-Command node -ErrorAction Stop).Source}
if(-not $CloudflaredExe){$CloudflaredExe=Join-Path $cache 'cloudflared.exe';Get-OfficialGithubAsset 'cloudflare/cloudflared' 'latest' 'cloudflared-windows-amd64.exe' $CloudflaredExe}
$bundle=Join-Path $OutputDirectory ('build-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($bundle)|Out-Null
try{
    foreach($name in @('server.mjs','simulation.mjs','racing.mjs','package.json','package-lock.json','Start-Launcher.cmd','Install-Playroom.cmd','Start-Game.cmd')){Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $bundle}
    foreach($name in @('launcher','public')){Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $bundle -Recurse}
    foreach($name in @('runtime','game','licenses')){[IO.Directory]::CreateDirectory((Join-Path $bundle $name))|Out-Null}
    [IO.File]::WriteAllText((Join-Path $bundle 'release.json'),(@{app='playroom';version=$Version}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $bundle 'runtime/node.exe')
    Copy-Item -LiteralPath $CloudflaredExe -Destination (Join-Path $bundle 'runtime/cloudflared.exe')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'game/arena.json') -Destination (Join-Path $bundle 'game/arena.json')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'game/circuit.json') -Destination (Join-Path $bundle 'game/circuit.json')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'game/circuits.json') -Destination (Join-Path $bundle 'game/circuits.json')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'game/car-shapes.json') -Destination (Join-Path $bundle 'game/car-shapes.json')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'game/fonts/LICENSE.txt') -Destination (Join-Path $bundle 'licenses/Font-LICENSE.txt')
    & npm.cmd ci --prefix $bundle --omit=dev --no-audit --no-fund
    if($LASTEXITCODE -ne 0){throw 'Dependency packaging failed.'}
    & $GodotExe --headless --path (Join-Path $projectRoot 'game') --editor --import --quit
    if($LASTEXITCODE -ne 0){throw 'Godot import failed.'}
    & $GodotExe --headless --path (Join-Path $projectRoot 'game') --export-release 'Windows Desktop' (Join-Path $bundle 'game/Playroom.exe')
    if($LASTEXITCODE -ne 0){throw 'Godot export failed.'}
    foreach($name in @('Playroom.exe','Playroom.pck')){if(-not(Test-Path -LiteralPath (Join-Path $bundle "game/$name"))){throw "Export did not produce $name"}}
    $licenses=@{'Godot-LICENSE.txt'='https://raw.githubusercontent.com/godotengine/godot/master/LICENSE.txt';'Node-LICENSE.txt'='https://raw.githubusercontent.com/nodejs/node/main/LICENSE';'Cloudflared-LICENSE.txt'='https://raw.githubusercontent.com/cloudflare/cloudflared/master/LICENSE'}
    foreach($name in $licenses.Keys){Invoke-WebRequest -UseBasicParsing -Uri $licenses[$name] -OutFile (Join-Path $bundle "licenses/$name") -TimeoutSec 30}
    $fileName="playroom-$Version-windows-x64.zip"
    $archive=Join-Path $OutputDirectory $fileName
    Compress-Archive -Path (Join-Path $bundle '*') -DestinationPath $archive -Force
    $manifest=@{app='playroom';formatVersion=1;version=$Version;fileName=$fileName;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant();downloadUrl="https://github.com/manduk56-hub/phonegame/releases/download/playroom-v$Version/$fileName"}
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'playroom-manifest.json'),($manifest|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    $launcherBundle=Join-Path $OutputDirectory 'Playroom-Installer'
    [IO.Directory]::CreateDirectory((Join-Path $launcherBundle 'launcher'))|Out-Null
    foreach($name in @('Start-Launcher.ps1','Start-Installer.ps1','Start-InstalledGame.ps1','Ui-Common.ps1','Launcher-Core.ps1','Launcher-Worker.ps1','playroom.ico')){Copy-Item -LiteralPath (Join-Path $projectRoot "launcher/$name") -Destination (Join-Path $launcherBundle 'launcher') -Force}
    Copy-Item -LiteralPath (Join-Path $projectRoot 'Install-Playroom.cmd') -Destination $launcherBundle -Force
    Compress-Archive -Path (Join-Path $launcherBundle '*') -DestinationPath (Join-Path $OutputDirectory 'Playroom-Installer.zip') -Force
    # Only prune after the game, manifest and installer have all been produced.
    try { Remove-OldPlayroomArchives -Directory $OutputDirectory -CurrentFileName $fileName }
    catch { Write-Warning ('Release built, but old archive cleanup failed: ' + $_.Exception.Message) }
    Write-Host "Ready: $archive"
}finally{
    $resolvedBundle=[IO.Path]::GetFullPath($bundle)
    if($resolvedBundle.StartsWith($OutputDirectory.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedBundle) -like 'build-*'){Remove-Item -LiteralPath $resolvedBundle -Recurse -Force}
}
