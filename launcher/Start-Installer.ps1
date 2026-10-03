param([string]$SourceManifest='',[string]$InstallDirectory='',[string]$PreviewPath='')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Ui-Common.ps1')
$root=Split-Path -Parent $PSScriptRoot
$InstallDirectory=Get-PlayroomDirectory $InstallDirectory $root
$SourceManifest=Get-LocalManifest $SourceManifest $root
$script:job=$null;$script:complete=$false;$script:closing=$false
$form=New-PlayroomForm '플레이룸 설치' 720 395
$null=Add-PlayroomLabel $form '플레이룸 설치' 28 25 660 45 24
$null=Add-PlayroomLabel $form '한 번 설치하면 바탕화면에서 바로 시작할 수 있습니다.' 30 82 660 30 11
$null=Add-PlayroomLabel $form '설치 위치' 30 140 660 25
$folder=New-Object Windows.Forms.TextBox;$folder.Location=[Drawing.Point]::new(30,173);$folder.Size=[Drawing.Size]::new(540,28);$folder.ReadOnly=$true;$folder.Text=$InstallDirectory;$form.Controls.Add($folder)
$browse=Add-PlayroomButton $form '폴더 선택' 585 169 105 35
$startAfter=New-Object Windows.Forms.CheckBox;$startAfter.Text='설치 완료 후 플레이룸 실행';$startAfter.Checked=$true;$startAfter.Location=[Drawing.Point]::new(30,225);$startAfter.Size=[Drawing.Size]::new(400,30);$form.Controls.Add($startAfter)
$status=Add-PlayroomLabel $form '게임과 필요한 실행 파일을 함께 설치합니다.' 30 270 660 45
$install=Add-PlayroomButton $form '설치' 460 327 110 40
$cancel=Add-PlayroomButton $form '닫기' 585 327 105 40
$browse.Add_Click({$dialog=New-Object Windows.Forms.FolderBrowserDialog;$dialog.Description='플레이룸을 설치할 상위 폴더를 선택하세요.';if($dialog.ShowDialog() -eq 'OK'){$folder.Text=Join-Path $dialog.SelectedPath 'Playroom'};$dialog.Dispose()})
$install.Add_Click({
    if($script:complete){
        if($startAfter.Checked){Start-PlayroomScript (Join-Path $folder.Text 'launcher/Start-InstalledGame.ps1') $folder.Text $SourceManifest}
        $form.Close();return
    }
    $script:job=Start-PlayroomJob 'install' $folder.Text $SourceManifest
    $install.Enabled=$false;$browse.Enabled=$false;$startAfter.Enabled=$false;$status.Text='최신 게임을 확인하고 설치합니다.'
})
$cancel.Add_Click({$form.Close()})
$timer=New-Object Windows.Forms.Timer;$timer.Interval=300
$timer.Add_Tick({
    if(-not $script:job){return}
    $result=Read-PlayroomStatus $script:job.statusPath;if($result){$status.Text=$result.message}
    if($script:job.process.HasExited){
        Close-PlayroomJob $script:job;$script:job=$null
        if($result.stage -eq 'installed'){$script:complete=$true;$install.Text='완료';$status.Text='설치가 완료되었습니다. 바탕화면의 플레이룸으로 실행하세요.'}
        $install.Enabled=$true;$startAfter.Enabled=$true;$browse.Enabled=-not $script:complete
        if($script:closing){$form.Close()}
    }
})
$form.Add_FormClosing({param($sender,$event);if($script:job){$event.Cancel=$true;$script:closing=$true;$status.Text='설치 작업이 끝나면 종료합니다.'}})
$form.Add_Shown({if($PreviewPath){Save-PlayroomPreview $form $PreviewPath;$form.Close()}})
$timer.Start();[Windows.Forms.Application]::Run($form);$timer.Stop();$timer.Dispose();$form.Dispose()
