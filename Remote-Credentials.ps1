function Confirm-RemoteServerUrl {
    param([string]$ServerUrl)
    $uri = $null
    if (-not [Uri]::TryCreate($ServerUrl.Trim(), [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo) {
        throw 'Enter your server HTTPS origin, for example https://game.example.com (no path or credentials).'
    }
    return $uri.GetLeftPart([UriPartial]::Authority)
}

function Get-RemoteServerUrl {
    param([string]$ServerUrl)
    if ($ServerUrl) { return Confirm-RemoteServerUrl -ServerUrl $ServerUrl }
    $settingsPath = Join-Path $env:LOCALAPPDATA 'DirtRally/server.json'
    if (Test-Path -LiteralPath $settingsPath) {
        try {
            $settings = [IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json
            $savedUrl = Confirm-RemoteServerUrl -ServerUrl $settings.serverUrl
            Write-Host ('Using your saved server: ' + $savedUrl)
            return $savedUrl
        } catch { Write-Host 'The saved server address is invalid. Enter your server address again.' }
    }
    while ($true) {
        $answer = Read-Host 'Your server HTTPS address (Q to cancel)'
        if ($answer.Trim().ToUpperInvariant() -eq 'Q') { return '' }
        try { return Confirm-RemoteServerUrl -ServerUrl $answer }
        catch { Write-Host $_.Exception.Message }
    }
}

function Save-RemoteServerUrl {
    param([string]$ServerUrl)
    $directory = Join-Path $env:LOCALAPPDATA 'DirtRally'
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    @{serverUrl=(Confirm-RemoteServerUrl -ServerUrl $ServerUrl)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'server.json') -Encoding utf8
}

function Get-RemoteHostKey {
    param([Parameter(Mandatory)][string]$ServerUrl, [string]$ProjectRoot = $PSScriptRoot)
    if ($env:DIRT_RALLY_HOST_KEY) { return $env:DIRT_RALLY_HOST_KEY }
    $origin = $ServerUrl.TrimEnd('/').ToLowerInvariant()
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $id = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($origin))).Replace('-','').ToLowerInvariant() }
    finally { $hash.Dispose() }
    $credentialDirectory = Join-Path $env:LOCALAPPDATA 'DirtRally/credentials'
    $credentialPath = Join-Path $credentialDirectory ($id + '.xml')
    if (Test-Path -LiteralPath $credentialPath) {
        $stored = Import-Clixml -LiteralPath $credentialPath
        if ($stored -isnot [Security.SecureString]) { throw 'Stored game credential is invalid.' }
        return [Net.NetworkCredential]::new('', $stored).Password
    }
    $secureValue = Read-Host 'Game host key (saved encrypted for this Windows user)' -AsSecureString
    $value = [Net.NetworkCredential]::new('', $secureValue).Password
    if (-not $value) { throw 'Game host key is required.' }
    [IO.Directory]::CreateDirectory($credentialDirectory) | Out-Null
    # Windows DPAPI protects this SecureString for the current Windows account.
    $secureValue | Export-Clixml -LiteralPath $credentialPath
    return $value
}
