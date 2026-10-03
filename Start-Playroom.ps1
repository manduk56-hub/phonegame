param(
    [ValidateSet('Installer', 'Launcher', 'Ask', 'Local', 'Server')][string]$Mode = 'Installer',
    [string]$ServerUrl = ''
)
$ErrorActionPreference = 'Stop'
if ($Mode -in @('Installer','Launcher')) {
    & (Join-Path $PSScriptRoot 'launcher/Start-Installer.ps1')
    return
}
if ($Mode -eq 'Ask') {
    Write-Host ''
    Write-Host 'PLAYROOM - 접속할 곳을 선택하세요'
    Write-Host '  1. 로컬      PC와 휴대폰을 같은 Wi-Fi에 연결'
    Write-Host '  2. 운영 서버  다른 Wi-Fi나 모바일 데이터로도 참가'
    Write-Host '  Q. 취소'
    do {
        $choice = Read-Host '선택 (1 / 2 / Q)'
        switch ($choice.Trim().ToUpperInvariant()) {
            '1' { $Mode = 'Local' }
            '2' { $Mode = 'Server' }
            'Q' { return }
            default { Write-Host '1, 2 또는 Q를 입력하세요.' }
        }
    } while ($Mode -eq 'Ask')
}
if ($Mode -eq 'Local') {
    & (Join-Path $PSScriptRoot 'Start-Game.ps1') -ServerUrl ''
} else {
    & (Join-Path $PSScriptRoot 'Start-RemoteGame.ps1') -ServerUrl $ServerUrl
}
