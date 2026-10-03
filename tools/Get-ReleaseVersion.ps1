param([long]$RunNumber)
$ErrorActionPreference='Stop'
if($RunNumber -lt 1){throw 'A positive workflow run number is required.'}
$package=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'package.json') -Raw | ConvertFrom-Json
if($package.version -notmatch '^(\d+)\.(\d+)\.\d+$'){throw 'The project version must have major.minor.patch format.'}
$version=$Matches[1]+'.'+$Matches[2]+'.'+$RunNumber
if($env:GITHUB_OUTPUT){Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value ('version='+$version) -Encoding utf8}
Write-Output $version