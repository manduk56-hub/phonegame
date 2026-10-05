$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
. (Join-Path $projectRoot 'launcher/Launcher-Core.ps1')
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $projectRoot 'launcher/Start-InstalledGame.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Launcher syntax is invalid.'}
$handler=$ast.Find({param($node) $node -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $node.Member.Value -eq 'Add_Tick'},$true).Arguments[0].ScriptBlock.GetScriptBlock()
$testRoot=Join-Path $projectRoot ('.runtime/update-startup-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot)|Out-Null
$requests=$testRoot;$stateDirectory=$testRoot
$status=@{Text=''};$progress=@{Visible=$true};$continue=@{Visible=$false};$cancel=@{Text='cancel'}
$script:installation=@{version='0.5.0'};$script:closing=$false;$script:session=$null
function Read-PlayroomStatus($Path){return $script:workerResult}
function Close-PlayroomJob($Job){}
function Start-GameSession{$script:launches++}
try{
    foreach($action in @('check','install')){
        foreach($result in @(@{stage='error';message='HTTP 404'},$null)){
            $script:workerResult=$result;$script:launches=0
            $script:job=@{action=$action;process=@{HasExited=$true};statusPath='mock'}
            $continue.Visible=$false;$progress.Visible=$true
            & $handler
            $record=Get-Content -LiteralPath (Join-Path $stateDirectory 'update.json') -Raw|ConvertFrom-Json
            if($record.action -ne $action -or $record.stage -ne 'error' -or -not $record.message){throw 'Update failure was not recorded.'}
            if($action -eq 'check'){
                if($script:launches -ne 1 -or $continue.Visible){throw 'Check failure blocked game startup.'}
            }elseif($script:launches -ne 0 -or -not $continue.Visible -or $progress.Visible){throw 'Install failure did not offer the installed game.'}
        }
    }
    Write-Host 'PASS: failed or missing update checks start the installed game; failed installs offer a choice; failures are recorded.'
}finally{
    $resolved=[IO.Path]::GetFullPath($testRoot)
    $allowed=[IO.Path]::GetFullPath((Join-Path $projectRoot '.runtime')).TrimEnd('\')+'\'
    if($resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'update-startup-*'){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
