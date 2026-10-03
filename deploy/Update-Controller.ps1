param([string]$SshTarget = '')
$ErrorActionPreference = 'Stop'
# Compatibility entry point: deploy the Git commit with the saved SSH key.
# Local files are never uploaded directly and password authentication is disabled.
& (Join-Path $PSScriptRoot 'Deploy-Git.ps1') -SshTarget $SshTarget
