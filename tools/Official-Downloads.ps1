$ErrorActionPreference = 'Stop'
function Get-OfficialGithubAsset {
    param([string]$Repository,[string]$Release,[string]$Name,[string]$Destination)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $metadata = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/$Release" -Headers @{'User-Agent'='Playroom';Accept='application/vnd.github+json'} -TimeoutSec 30
    $asset = $metadata.assets | Where-Object name -eq $Name | Select-Object -First 1
    if (-not $asset) { throw "Missing official release asset: $Name" }
    $digest = $asset.digest
    if (-not $digest -or $digest -notmatch '^sha256:[a-fA-F0-9]{64}$') {
        $checksumAsset = $metadata.assets | Where-Object name -match 'SHA256-SUMS' | Select-Object -First 1
        if (-not $checksumAsset) { throw "No official SHA256 for $Name" }
        $checksums = (Invoke-WebRequest -UseBasicParsing $checksumAsset.browser_download_url -TimeoutSec 30).Content
        $match = [regex]::Match($checksums, '(?m)^([a-fA-F0-9]{64})\s+\*?' + [regex]::Escape($Name) + '\s*$')
        if (-not $match.Success) { throw "No checksum entry for $Name" }
        $digest = 'sha256:' + $match.Groups[1].Value
    }
    if (-not (Test-Path -LiteralPath $Destination) -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $digest.Substring(7)) {
        Write-Host "Downloading $Name"
        Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $Destination -TimeoutSec 900
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $digest.Substring(7)) { throw "SHA256 mismatch: $Name" }
}
