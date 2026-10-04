$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Release-Retention.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('playroom-retention-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
try {
    $names = @('playroom-0.2.0-windows-x64.zip','playroom-0.2.1-windows-x64.zip','playroom-0.2.2-windows-x64.zip','playroom-0.3.0-windows-x64.zip')
    for ($i=0; $i -lt $names.Count; $i++) {
        $file = Join-Path $testRoot $names[$i]
        [IO.File]::WriteAllText($file,'test')
        [IO.File]::SetLastWriteTimeUtc($file,[DateTime]::UtcNow.AddMinutes($i))
    }
    foreach ($name in @('Playroom-Installer.zip','playroom-manifest.json','unrelated.zip')) {
        [IO.File]::WriteAllText((Join-Path $testRoot $name),'preserve')
    }
    $failed = $false
    try { Remove-OldPlayroomArchives $testRoot 'playroom-9.0.0-windows-x64.zip' } catch { $failed = $true }
    if (-not $failed -or @(Get-ChildItem -LiteralPath $testRoot -File).Count -ne 7) { throw 'Missing current archive must leave files unchanged.' }
    # Even an older-numbered current build must be preserved.
    Remove-OldPlayroomArchives $testRoot $names[0]
    $expected = @($names[0],$names[3],'Playroom-Installer.zip','playroom-manifest.json','unrelated.zip') | Sort-Object
    $actual = @(Get-ChildItem -LiteralPath $testRoot -File | Select-Object -ExpandProperty Name | Sort-Object)
    if (@(Compare-Object $expected $actual).Count) { throw 'Retention did not preserve the current build, previous build and unrelated files.' }
    Remove-OldPlayroomArchives $testRoot $names[0]
    if (@(Get-ChildItem -LiteralPath $testRoot -File).Count -ne 5) { throw 'Repeated cleanup changed retained files.' }
    Write-Host 'Release retention checks passed.'
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($resolved.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'playroom-retention-*') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
