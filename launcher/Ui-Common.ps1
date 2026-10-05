$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
. (Join-Path $PSScriptRoot 'Launcher-Core.ps1')

function Get-PlayroomDirectory {
    param([string]$Requested,[string]$Root)
    if($Requested){return [IO.Path]::GetFullPath($Requested)}
    if(Test-Path -LiteralPath (Join-Path $Root 'installation.json')){return $Root}
    $preferences=Join-Path $env:LOCALAPPDATA 'Playroom/launcher.json'
    if(Test-Path -LiteralPath $preferences){try{return ([IO.File]::ReadAllText($preferences)|ConvertFrom-Json).directory}catch{}}
    return (Join-Path $env:LOCALAPPDATA 'Programs/Playroom')
}
function Get-LocalManifest {
    param([string]$Requested,[string]$Root)
    if($Requested){return $Requested}
    # Installed launchers must check online, even if an old offline bundle is nearby.
    if(Test-Path -LiteralPath (Join-Path $Root 'installation.json')){return ''}
    foreach($candidate in @((Join-Path $Root 'playroom-manifest.json'),(Join-Path (Split-Path -Parent $Root) 'playroom-manifest.json'),(Join-Path $Root '.runtime/releases/playroom-manifest.json'))){if(Test-Path -LiteralPath $candidate){return $candidate}}
    return ''
}
function Start-PlayroomScript([string]$Path,[string]$Directory,[string]$Manifest='') {
    $arguments=@('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"'+$Path+'"'),'-InstallDirectory',('"'+$Directory+'"'))
    if($Manifest){$arguments+=@('-SourceManifest',('"'+$Manifest+'"'))}
    Start-Process (Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe') -ArgumentList $arguments -WindowStyle Hidden
}
function Start-PlayroomJob {
    param([string]$Action,[string]$Directory,[string]$Manifest)
    $jobs=Join-Path $env:LOCALAPPDATA 'Playroom/jobs'
    [IO.Directory]::CreateDirectory($jobs)|Out-Null
    $id=[Guid]::NewGuid().ToString('N')
    $jobPath=Join-Path $jobs ($id+'.job.json');$statusPath=Join-Path $jobs ($id+'.status.json')
    [IO.File]::WriteAllText($jobPath,(@{action=$Action;directory=$Directory;sourceManifest=$Manifest;statusPath=$statusPath}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    $process=Start-Process (Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe') -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'Launcher-Worker.ps1')+'"'),'-JobPath',('"'+$jobPath+'"')) -WindowStyle Hidden -PassThru
    return @{process=$process;jobPath=$jobPath;statusPath=$statusPath;action=$Action}
}
function Read-PlayroomStatus([string]$Path){if(Test-Path -LiteralPath $Path){try{return ([IO.File]::ReadAllText($Path)|ConvertFrom-Json)}catch{}};return $null}
function Close-PlayroomJob($Job){$Job.process.Dispose();foreach($file in @($Job.jobPath,$Job.statusPath)){if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file}}}
function New-PlayroomForm([string]$Title,[int]$Width,[int]$Height){
    $form=New-Object Windows.Forms.Form
    $form.Text=$Title;$form.ClientSize=[Drawing.Size]::new($Width,$Height);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedSingle';$form.MaximizeBox=$false
    $form.BackColor=[Drawing.ColorTranslator]::FromHtml('#181e20');$form.ForeColor=[Drawing.ColorTranslator]::FromHtml('#eee9da');$form.Font=[Drawing.Font]::new('맑은 고딕',10)
    $icon=Join-Path $PSScriptRoot 'playroom.ico';if(Test-Path -LiteralPath $icon){$form.Icon=[Drawing.Icon]::new($icon)}
    return $form
}
function Add-PlayroomLabel($Form,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height,[int]$Size=10){
    $label=New-Object Windows.Forms.Label;$label.Text=$Text;$label.Location=[Drawing.Point]::new($X,$Y);$label.Size=[Drawing.Size]::new($Width,$Height);$label.Font=[Drawing.Font]::new('맑은 고딕',$Size);$Form.Controls.Add($label);return $label
}
function Add-PlayroomButton($Form,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height){
    $button=New-Object Windows.Forms.Button;$button.Text=$Text;$button.Location=[Drawing.Point]::new($X,$Y);$button.Size=[Drawing.Size]::new($Width,$Height);$button.FlatStyle='Flat';$button.BackColor=[Drawing.ColorTranslator]::FromHtml('#f17c64');$button.ForeColor=[Drawing.ColorTranslator]::FromHtml('#181e20');$Form.Controls.Add($button);return $button
}
function Save-PlayroomPreview($Form,[string]$Path){$bitmap=[Drawing.Bitmap]::new($Form.Width,$Form.Height);try{$Form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$Form.Width,$Form.Height));$bitmap.Save($Path,[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose()}}
if(-not ('PlayroomWindow' -as [type])){
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PlayroomWindow {
    [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int processId);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
}
'@
}
function Show-PlayroomGame($State){
    if($State.gamePid){$game=Get-Process -Id $State.gamePid -ErrorAction SilentlyContinue;if($game -and $game.MainWindowHandle -ne [IntPtr]::Zero){$null=[PlayroomWindow]::ShowWindowAsync($game.MainWindowHandle,9);$null=[PlayroomWindow]::SetForegroundWindow($game.MainWindowHandle);return $true}}
    return $false
}
