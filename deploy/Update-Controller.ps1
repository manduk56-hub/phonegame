param([string]$SshTarget = 'root@115.68.208.145')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $projectDir '.runtime/dirt-rally-controller-update.tgz'
$statusPath = Join-Path $projectDir '.runtime/controller-deploy-status.json'
$logPath = Join-Path $projectDir '.runtime/controller-deploy.log'
function Write-DeployStatus([string]$state, [string]$message) {
    @{state=$state; message=$message; time=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding utf8
}
try {
    Set-Location -LiteralPath $projectDir
    & tar -czf $archivePath public/controller.html public/controller.js public/style.css
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare controller archive.' }
    $archiveBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($archivePath))
    # The payload contains public UI files only. SSH reads the password from
    # the interactive terminal; no password is stored in this script or log.
    $remoteTemplate = @'
set -eu
test -d /opt/dirt-rally/public
backup=/opt/dirt-rally/backups/controller-$(date +%Y%m%d-%H%M%S)-$$
mkdir -p $backup
cp -p /opt/dirt-rally/public/controller.html /opt/dirt-rally/public/controller.js /opt/dirt-rally/public/style.css $backup/
stage=$(mktemp -d /tmp/dirt-rally-controller.XXXXXX)
trap 'rm -rf -- $stage' EXIT
printf '%s' '__ARCHIVE__' | base64 -d | tar -xz -C $stage
for file in controller.html controller.js style.css; do
  test -s $stage/public/$file
done
for file in controller.html controller.js style.css; do
  install -o dirt-rally -g dirt-rally -m 0644 $stage/public/$file /opt/dirt-rally/public/$file
done
sha256sum /opt/dirt-rally/public/controller.html /opt/dirt-rally/public/controller.js /opt/dirt-rally/public/style.css
printf 'CONTROLLER_UPDATE_OK\n'
'@
    $remoteCommand = $remoteTemplate.Replace('__ARCHIVE__', $archiveBase64).Replace("`r`n", "`n")
    Write-DeployStatus 'waiting-for-login' 'Waiting for interactive SSH authentication.'
    Write-Host 'Deploying controller HTML, JS and CSS. The game server will keep running.'
    Write-Host 'Enter the SSH password when prompted. Password characters will not be displayed.'
    # Keep SSH diagnostic output too, so a failed connection has an actionable
    # reason. Password input is read by SSH directly from the terminal.
    $ErrorActionPreference = 'Continue'
    & ssh -o ConnectTimeout=20 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive $SshTarget $remoteCommand 2>&1 | Tee-Object -FilePath $logPath
    $sshExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($sshExit -ne 0) { throw "SSH deployment failed (exit $sshExit). See .runtime/controller-deploy.log for the connection error." }
    Write-DeployStatus 'complete' 'Controller files deployed; server was not restarted.'
    Write-Host 'Deployment complete. Refresh the phone controller.' -ForegroundColor Green
} catch {
    Write-DeployStatus 'failed' $_.Exception.Message
    Write-Host $_.Exception.Message -ForegroundColor Red
}
