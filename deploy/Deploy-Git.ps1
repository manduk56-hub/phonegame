param(
    [string]$SshTarget = '',
    [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh/dirt-rally-actions-deploy')
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $env:LOCALAPPDATA 'DirtRally/deployment.json'
if (-not $SshTarget -and (Test-Path -LiteralPath $settingsPath)) {
    $settings = [IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json
    $SshTarget = $settings.sshTarget
}
if (-not $SshTarget) { throw 'Specify your own deployment server with -SshTarget user@host, or save sshTarget in your local DirtRally/deployment.json.' }
if (-not (Test-Path -LiteralPath $IdentityFile)) { throw 'Deployment key is missing on this PC. Set up the deployment key once; password fallback is disabled.' }
$commit = (& git -C $projectDirectory rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Could not find the Git commit to deploy.' }
$remoteLine = & git -C $projectDirectory ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or -not $remoteLine -or ($remoteLine -split '\s+')[0] -ne $commit) { throw 'The local commit must match GitHub main before deployment. This script does not commit or push local files.' }
Write-Host ('Deploying Git commit ' + $commit.Substring(0,12) + ' using the saved SSH key.')
& ssh -i $IdentityFile -o IdentitiesOnly=yes -o BatchMode=yes -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o StrictHostKeyChecking=yes -o ConnectTimeout=20 $SshTarget "deploy $commit"
if ($LASTEXITCODE -ne 0) { throw 'Key-based deployment failed. No password prompt or fallback was used.' }
