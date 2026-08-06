param(
    [Parameter(Mandatory)]
    [string] $Path
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$ffprobe = Get-Command 'ffprobe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $ffprobe) {
    throw 'ffprobe was not found on PATH. Install FFmpeg with ffprobe before validating the final MP4.'
}

$probeArgs = @(
    '-v', 'error',
    '-show_entries', 'format=size,duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,nb_frames',
    '-of', 'json',
    $resolvedPath
)
$probeText = (& $ffprobe.Source @probeArgs 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) {
    throw "ffprobe failed: $probeText"
}
$probe = $probeText | ConvertFrom-Json
$video = @($probe.streams | Where-Object { $_.codec_type -eq 'video' }) | Select-Object -First 1
if (-not $video) {
    throw 'No video stream found.'
}

$errors = [System.Collections.Generic.List[string]]::new()
if ($video.codec_name -ne 'h264') { $errors.Add("codec must be h264, got $($video.codec_name)") }
if ($video.pix_fmt -ne 'yuv420p') { $errors.Add("pixel format must be yuv420p, got $($video.pix_fmt)") }
if (($video.width % 2) -ne 0 -or ($video.height % 2) -ne 0) { $errors.Add("dimensions must be even, got $($video.width)x$($video.height)") }

$rateParts = [string]$video.avg_frame_rate -split '/'
$fps = if ($rateParts.Count -eq 2 -and [double]$rateParts[1] -ne 0) {
    [double]$rateParts[0] / [double]$rateParts[1]
} else {
    [double]$video.avg_frame_rate
}
if ([math]::Abs($fps - 24.0) -gt 0.01) { $errors.Add("frame rate must be 24 fps, got $fps") }

$frameCount = 0
if ([int]::TryParse([string]$video.nb_frames, [ref]$frameCount) -eq $false) {
    $frameCount = [int][math]::Round(([double]$probe.format.duration) * $fps)
}
if ($frameCount -lt 44 -or $frameCount -gt 720) { $errors.Add("frame count must be 44-720, got $frameCount") }

$size = [int64]$probe.format.size
if ($size -gt 209715200) { $errors.Add("file size must not exceed 200 MiB, got $size bytes") }

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

[pscustomobject]@{
    Path = $resolvedPath
    Codec = $video.codec_name
    PixelFormat = $video.pix_fmt
    Resolution = "$($video.width)x$($video.height)"
    Fps = $fps
    Frames = $frameCount
    SizeBytes = $size
    Status = 'PASS'
} | Format-List
