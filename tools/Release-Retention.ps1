function Remove-OldPlayroomArchives {
    param([Parameter(Mandatory)][string]$Directory,[Parameter(Mandatory)][string]$CurrentFileName)
    $root = [IO.Path]::GetFullPath($Directory).TrimEnd('\')
    $pattern = '^playroom-\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?-windows-x64\.zip$'
    if ($CurrentFileName -notmatch $pattern) { throw 'Invalid current release filename.' }
    $current = Join-Path $root $CurrentFileName
    if (-not (Test-Path -LiteralPath $current -PathType Leaf)) { throw 'Current release archive is missing; cleanup cancelled.' }
    # Keep the successful build and the most recently written other build.
    $older = @(Get-ChildItem -LiteralPath $root -File | Where-Object {
        $_.Name -match $pattern -and $_.Name -ne $CurrentFileName -and
        -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
    } | Sort-Object LastWriteTimeUtc,Name -Descending)
    foreach ($archive in @($older | Select-Object -Skip 1)) {
        $target = [IO.Path]::GetFullPath($archive.FullName)
        if (-not [StringComparer]::OrdinalIgnoreCase.Equals((Split-Path -Parent $target),$root)) {
            throw 'Archive cleanup target is outside the release directory.'
        }
        Remove-Item -LiteralPath $target -Force
    }
}
