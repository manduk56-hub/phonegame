$ErrorActionPreference = 'Stop'
$script:ReleaseRepository = 'manduk56-hub/phonegame'

function Compare-PlayroomVersion {
    param([string]$Left,[string]$Right)
    $leftParts=$Left -split '-',2; $rightParts=$Right -split '-',2
    $comparison=([Version]$leftParts[0]).CompareTo([Version]$rightParts[0])
    if($comparison -ne 0){return $comparison}
    if($leftParts.Count -eq 1 -and $rightParts.Count -eq 1){return 0}
    if($leftParts.Count -eq 1){return 1}
    if($rightParts.Count -eq 1){return -1}
    $leftIdentifiers=$leftParts[1].Split('.');$rightIdentifiers=$rightParts[1].Split('.')
    for($index=0;$index -lt [Math]::Min($leftIdentifiers.Count,$rightIdentifiers.Count);$index++){
        $leftId=$leftIdentifiers[$index];$rightId=$rightIdentifiers[$index]
        if($leftId -eq $rightId){continue}
        $leftNumeric=$leftId -match '^\d+$';$rightNumeric=$rightId -match '^\d+$'
        if($leftNumeric -and $rightNumeric){return ([decimal]$leftId).CompareTo([decimal]$rightId)}
        if($leftNumeric){return -1};if($rightNumeric){return 1}
        return [StringComparer]::Ordinal.Compare($leftId,$rightId)
    }
    return $leftIdentifiers.Count.CompareTo($rightIdentifiers.Count)
}

function Write-JobStatus {
    param([string]$Path, [string]$Stage, [string]$Message, $Extra = @{})
    $value = @{stage=$Stage; message=$Message}
    foreach ($key in $Extra.Keys) { $value[$key] = $Extra[$key] }
    $temp = $Path + '.tmp'
    [IO.File]::WriteAllText($temp, ($value | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Get-ReleaseManifest {
    param([string]$SourceManifest = '')
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if ($SourceManifest) {
        if (-not (Test-Path -LiteralPath $SourceManifest -PathType Leaf)) { throw '동봉된 게임 설치파일을 찾지 못했습니다.' }
        $manifest = [IO.File]::ReadAllText($SourceManifest) | ConvertFrom-Json
        $manifest | Add-Member -NotePropertyName sourceDirectory -NotePropertyValue (Split-Path -Parent ([IO.Path]::GetFullPath($SourceManifest))) -Force
    } else {
        try {
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$script:ReleaseRepository/releases/latest" -Headers @{'User-Agent'='Playroom-Launcher'; Accept='application/vnd.github+json'} -TimeoutSec 10
            $asset = $release.assets | Where-Object name -eq 'playroom-manifest.json' | Select-Object -First 1
            if (-not $asset) { throw 'No Playroom package.' }
            $manifest = Invoke-RestMethod -Uri $asset.browser_download_url -Headers @{'User-Agent'='Playroom-Launcher'} -TimeoutSec 10
        } catch { throw '최신 게임을 확인하지 못했습니다. 인터넷 연결 또는 게임 출시 상태를 확인하세요. 동봉된 설치파일이 있으면 오프라인 설치할 수 있습니다.' }
    }
    if ($manifest.app -ne 'playroom' -or $manifest.formatVersion -ne 1 -or $manifest.version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$' -or $manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $manifest.fileName -notmatch '^playroom-[A-Za-z0-9.-]+-windows-x64\.zip$') {
        throw '게임 배포 정보가 올바르지 않습니다.'
    }
    if (-not $SourceManifest -and $manifest.downloadUrl -notmatch ('^https://github\.com/' + [regex]::Escape($script:ReleaseRepository) + '/releases/download/[^/]+/playroom-[A-Za-z0-9.-]+-windows-x64\.zip$')) { throw '허용되지 않은 게임 다운로드 주소입니다.' }
    return $manifest
}

function Expand-CheckedArchive {
    param([string]$Archive, [string]$Destination)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $base = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $total = [long]0
        foreach ($entry in $zip.Entries) {
            $target = [IO.Path]::GetFullPath((Join-Path $Destination $entry.FullName))
            if (-not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -or $entry.FullName.Contains(':')) { throw '압축파일에 잘못된 경로가 있습니다.' }
            $total += $entry.Length
            if ($total -gt 3GB) { throw '게임 설치파일이 허용 크기를 초과합니다.' }
        }
        [IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Destination)
    } finally { $zip.Dispose() }
}

function Get-Installation {
    param([string]$Directory)
    $file = Join-Path $Directory 'installation.json'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
    $install = [IO.File]::ReadAllText($file) | ConvertFrom-Json
    if ($install.app -ne 'playroom' -or $install.version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$') { throw '설치 정보가 올바르지 않습니다.' }
    $active = Join-Path $Directory ('versions/' + $install.version)
    if (-not (Test-Path -LiteralPath (Join-Path $active 'runtime/node.exe')) -or -not (Test-Path -LiteralPath (Join-Path $active 'game/Playroom.exe'))) { throw '게임 파일이 누락되었습니다. 다시 설치하세요.' }
    $install | Add-Member -NotePropertyName activePath -NotePropertyValue $active -Force
    return $install
}

function Install-Playroom {
    param([string]$Directory, $Manifest, [string]$StatusPath, [switch]$SkipShortcut)
    $Directory = [IO.Path]::GetFullPath($Directory)
    if ($Directory -eq [IO.Path]::GetPathRoot($Directory)) { throw '드라이브 최상위 대신 게임 전용 폴더를 선택하세요.' }
    [IO.Directory]::CreateDirectory($Directory) | Out-Null
    # Do not adopt a directory belonging to another application.
    if ((Get-ChildItem -LiteralPath $Directory -Force | Select-Object -First 1) -and -not (Test-Path -LiteralPath (Join-Path $Directory 'installation.json'))) { throw '비어 있는 폴더 또는 기존 플레이룸 설치 폴더를 선택하세요.' }
    $current = Get-Installation -Directory $Directory
    if ($current) {
        $lockPath = Join-Path $Directory 'state/session.lock'
        if (Test-Path -LiteralPath $lockPath) {
            $ownerId = [int]([IO.File]::ReadAllText($lockPath))
            if (Get-Process -Id $ownerId -ErrorAction SilentlyContinue) { throw '게임을 종료한 뒤 업데이트하세요.' }
        }
        if ($current.version -eq $Manifest.version) {
            if ($current.sha256 -ne $Manifest.sha256) { throw '같은 버전의 설치파일이 변경되었습니다. 새 버전으로 배포해야 합니다.' }
            Write-JobStatus $StatusPath 'installed' '이미 최신 버전이 설치되어 있습니다.' @{version=$current.version; directory=$Directory}
            return
        }
        if ((Compare-PlayroomVersion $Manifest.version $current.version) -lt 0) { throw '설치된 게임보다 오래된 버전으로 업데이트할 수 없습니다.' }
    }
    $staging = Join-Path $Directory ('.install-' + [Guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($staging) | Out-Null
    try {
        Write-JobStatus $StatusPath 'downloading' '게임을 다운로드하고 있습니다.'
        $archive = Join-Path $staging 'game.zip'
        if ($Manifest.PSObject.Properties.Name -contains 'sourceDirectory') {
            Copy-Item -LiteralPath (Join-Path $Manifest.sourceDirectory $Manifest.fileName) -Destination $archive
        } else { Invoke-WebRequest -UseBasicParsing -Uri $Manifest.downloadUrl -OutFile $archive -TimeoutSec 600 }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Manifest.sha256) { throw '다운로드 파일 검사에 실패했습니다. 기존 설치는 유지됩니다.' }
        Write-JobStatus $StatusPath 'installing' '게임 파일을 설치하고 있습니다.'
        $expanded = Join-Path $staging 'expanded'
        Expand-CheckedArchive -Archive $archive -Destination $expanded
        foreach ($required in @('release.json','server.mjs','simulation.mjs','racing.mjs','game/circuit.json','game/car-shapes.json','public/race-controller.js','public/race-scene.js','public/race-sensors.js','launcher/session.mjs','launcher/Start-Launcher.ps1','launcher/Launcher-Core.ps1','launcher/Launcher-Worker.ps1','Start-Launcher.cmd','Install-Playroom.cmd','Start-Game.cmd','launcher/Start-Installer.ps1','launcher/Start-InstalledGame.ps1','launcher/Ui-Common.ps1','runtime/node.exe','runtime/cloudflared.exe','game/Playroom.exe','game/Playroom.pck','node_modules/ws/package.json','node_modules/qrcode/package.json','node_modules/three/package.json','public/controller.html')) {
            if (-not (Test-Path -LiteralPath (Join-Path $expanded $required) -PathType Leaf)) { throw "설치파일에 필요한 파일이 없습니다: $required" }
        }
        $packageRelease=[IO.File]::ReadAllText((Join-Path $expanded 'release.json'))|ConvertFrom-Json
        if($packageRelease.app -ne 'playroom' -or $packageRelease.version -ne $Manifest.version){throw '설치파일의 버전이 배포 정보와 다릅니다.'}
        $versions = Join-Path $Directory 'versions'
        [IO.Directory]::CreateDirectory($versions) | Out-Null
        $destination = Join-Path $versions $Manifest.version
        if (Test-Path -LiteralPath $destination) { throw '해당 버전 폴더가 이미 있습니다. 다른 빈 폴더를 선택하세요.' }
        Move-Item -LiteralPath $expanded -Destination $destination
        # Stable launcher paths keep desktop shortcuts valid across updates.
        [IO.Directory]::CreateDirectory((Join-Path $Directory 'launcher')) | Out-Null
        foreach ($name in @('Start-Launcher.ps1','Start-Installer.ps1','Start-InstalledGame.ps1','Ui-Common.ps1','Launcher-Core.ps1','Launcher-Worker.ps1')) {
            Copy-Item -LiteralPath (Join-Path $destination "launcher/$name") -Destination (Join-Path $Directory "launcher/$name") -Force
        }
        Copy-Item -LiteralPath (Join-Path $destination 'Start-Launcher.cmd') -Destination (Join-Path $Directory 'Start-Launcher.cmd') -Force
        foreach($name in @('Install-Playroom.cmd','Start-Game.cmd')) { Copy-Item -LiteralPath (Join-Path $destination $name) -Destination (Join-Path $Directory $name) -Force }
        $packageIcon = Join-Path $destination 'launcher/playroom.ico'
        if (Test-Path -LiteralPath $packageIcon) {
            Copy-Item -LiteralPath $packageIcon -Destination (Join-Path $Directory 'launcher/playroom.ico') -Force
        }
        $installation = @{app='playroom'; version=$Manifest.version; sha256=$Manifest.sha256}
        $temp = Join-Path $Directory 'installation.json.tmp'
        [IO.File]::WriteAllText($temp, ($installation | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temp -Destination (Join-Path $Directory 'installation.json') -Force
        if (-not $SkipShortcut) {
            Write-JobStatus $StatusPath 'shortcut' '바탕화면 바로가기를 만들고 있습니다.'
            $shell = New-Object -ComObject WScript.Shell
            $desktop = [Environment]::GetFolderPath('DesktopDirectory')
            foreach ($item in @(@{name='플레이룸';auto=$false})) {
                $shortcut = $shell.CreateShortcut((Join-Path $desktop ($item.name + '.lnk')))
                $shortcut.TargetPath = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
                $shortcut.Arguments = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Directory 'launcher/Start-InstalledGame.ps1') + '"'
                $shortcut.WorkingDirectory = $Directory
                $shortcut.IconLocation = (Join-Path $destination 'game/Playroom.exe') + ',0'
                if (Test-Path -LiteralPath (Join-Path $Directory 'launcher/playroom.ico')) {
                    $shortcut.IconLocation = (Join-Path $Directory 'launcher/playroom.ico') + ',0'
                }
                $shortcut.Save()
            }
            # Replace only the old shortcuts created for this exact installation.
            $launcherPath = Join-Path $Directory 'launcher/Start-Launcher.ps1'
            $installerPath = Join-Path $Directory 'launcher/Start-Installer.ps1'
            foreach ($oldName in @('PLAYROOM','DIRT RALLY','플레이룸 런처','플레이룸 설치')) {
                $oldPath = Join-Path $desktop ($oldName + '.lnk')
                if (Test-Path -LiteralPath $oldPath) {
                    $oldShortcut = $shell.CreateShortcut($oldPath)
                    $expectedPath = if ($oldName -eq '플레이룸 설치') { $installerPath } else { $launcherPath }
                    if ($oldShortcut.Arguments.IndexOf(('"' + $expectedPath + '"'),[StringComparison]::OrdinalIgnoreCase) -ge 0) { Remove-Item -LiteralPath $oldPath }
                }
            }
        }
        $preferences = Join-Path $env:LOCALAPPDATA 'Playroom'
        [IO.Directory]::CreateDirectory($preferences) | Out-Null
        [IO.File]::WriteAllText((Join-Path $preferences 'launcher.json'), (@{directory=$Directory} | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        Write-JobStatus $StatusPath 'installed' '설치 완료! 바탕화면의 플레이룸으로 바로 실행할 수 있습니다.' @{version=$Manifest.version; directory=$Directory}
    } finally {
        # Verify the exact absolute target before any recursive cleanup.
        $resolvedStaging = [IO.Path]::GetFullPath($staging)
        $expectedBase = $Directory.TrimEnd('\') + '\'
        if ($resolvedStaging.StartsWith($expectedBase, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedStaging) -like '.install-*' -and (Test-Path -LiteralPath $resolvedStaging)) { Remove-Item -LiteralPath $resolvedStaging -Recurse -Force }
    }
}
