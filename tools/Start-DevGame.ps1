param([ValidateSet('internet','lan')][string]$Mode='internet')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$nodeExe=(Get-Command node -ErrorAction Stop).Source
$godotExe=$env:GODOT_EXE
if(-not $godotExe){$godotExe=Get-ChildItem -LiteralPath (Join-Path $projectRoot '.runtime/godot') -Filter '*.exe' -ErrorAction SilentlyContinue|Where-Object Name -NotLike '*console*'|Select-Object -First 1 -ExpandProperty FullName}
if(-not $godotExe){throw '개발용 Godot가 없습니다. GODOT_EXE를 설정하세요.'}
if(-not(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/ws'))){& npm.cmd ci --prefix $projectRoot --no-audit --no-fund;if($LASTEXITCODE -ne 0){throw '개발 의존성을 설치하지 못했습니다.'}}
$cloudflared=Join-Path $projectRoot '.runtime/build-cache/cloudflared.exe'
if($Mode -eq 'internet' -and -not(Test-Path -LiteralPath $cloudflared)){
    . (Join-Path $PSScriptRoot 'Official-Downloads.ps1')
    [IO.Directory]::CreateDirectory((Split-Path -Parent $cloudflared))|Out-Null
    Get-OfficialGithubAsset 'cloudflare/cloudflared' 'latest' 'cloudflared-windows-amd64.exe' $cloudflared
}
& $godotExe --headless --path (Join-Path $projectRoot 'game') --editor --import --quit
if($LASTEXITCODE -ne 0){throw '게임 리소스를 가져오지 못했습니다.'}
$state=Join-Path $projectRoot '.runtime/development-session'
[IO.Directory]::CreateDirectory($state)|Out-Null
Write-Host '개발 실행: 현재 작업 폴더의 소스를 사용합니다. 배포용 게임 설치와 별도로 실행됩니다.'
& $nodeExe (Join-Path $projectRoot 'launcher/session.mjs') ("--mode=$Mode") ("--status="+(Join-Path $state 'session.json')) ("--stop="+(Join-Path $state 'stop')) ("--game=$godotExe") ("--project="+(Join-Path $projectRoot 'game')) ("--tunnel=$cloudflared")
if($LASTEXITCODE -ne 0){throw '개발 게임 실행에 실패했습니다.'}
