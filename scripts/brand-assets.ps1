# brand-assets.ps1 - draws the store's icons and Play Store graphics from the brand
# colours (green #174F42, gold #C9A45C). Re-run after changing the look.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\brand-assets.ps1
#
# Writes: public\icons\icon-192.png, icon-512.png, maskable-512.png
#         app\icon.png, app\apple-icon.png
#         android\play-store\icon-512.png, feature-graphic.png

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$Root = Split-Path -Parent $PSScriptRoot
$Green = [System.Drawing.ColorTranslator]::FromHtml('#174F42')
$DarkGreen = [System.Drawing.ColorTranslator]::FromHtml('#103D32')
$Gold = [System.Drawing.ColorTranslator]::FromHtml('#C9A45C')
$Cream = [System.Drawing.ColorTranslator]::FromHtml('#F4ECDC')

function New-Canvas($w, $h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
    return @($bmp, $g)
}
function Save($bmp, $path) {
    New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    Write-Host "wrote $path"
}
function Draw-A($g, $x, $y, $size, $color) {
    $font = New-Object System.Drawing.Font 'Georgia', ([single]$size), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF ([single]$x), ([single]$y), ([single]($size * 1.6)), ([single]($size * 1.6))
    $g.DrawString('A', $font, (New-Object System.Drawing.SolidBrush $color), $rect, $fmt)
}
function Rounded($g, $size, $radius, $brush) {
    $d = $radius * 2; $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($size - $d - 1, 0, $d, $d, 270, 90)
    $p.AddArc($size - $d - 1, $size - $d - 1, $d, $d, 0, 90); $p.AddArc(0, $size - $d - 1, $d, $d, 90, 90)
    $p.CloseFigure(); $g.FillPath($brush, $p)
}

# App icon: gold A on green, rounded; "full" fills the square for maskable/Play use.
function Icon($size, $path, [switch]$Full) {
    $bmp, $g = New-Canvas $size $size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $size, $size), $Green, $DarkGreen
    if ($Full) { $g.FillRectangle($brush, 0, 0, $size, $size) } else { Rounded $g $size ([int]($size * 0.22)) $brush }
    $letter = if ($Full) { $size * 0.46 } else { $size * 0.58 }  # maskable keeps the letter in the safe zone
    Draw-A $g (($size - $letter * 1.6) / 2) (($size - $letter * 1.6) / 2 + $size * 0.02) $letter $Gold
    $g.Dispose(); Save $bmp $path
}

Icon 192 (Join-Path $Root 'public\icons\icon-192.png')
Icon 512 (Join-Path $Root 'public\icons\icon-512.png')
Icon 512 (Join-Path $Root 'public\icons\maskable-512.png') -Full
Icon 192 (Join-Path $Root 'app\icon.png')
Icon 180 (Join-Path $Root 'app\apple-icon.png') -Full
Icon 512 (Join-Path $Root 'android\play-store\icon-512.png') -Full

# Play Store feature graphic, 1024 x 500.
$bmp, $g = New-Canvas 1024 500
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 1024, 500), $DarkGreen, $Green
$g.FillRectangle($bg, 0, 0, 1024, 500)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, $Gold))), 700, -160, 520, 520)
$g.FillRectangle((New-Object System.Drawing.SolidBrush $Gold), 0, 490, 1024, 10)
$tile = New-Object System.Drawing.Drawing2D.GraphicsPath; $tile.AddRectangle((New-Object System.Drawing.Rectangle 90, 150, 200, 200))
$g.DrawRectangle((New-Object System.Drawing.Pen $Gold, 4), 90, 150, 200, 200)
Draw-A $g 110 170 100 $Gold
$title = New-Object System.Drawing.Font 'Georgia', 64, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$tag = New-Object System.Drawing.Font 'Segoe UI', 28, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$small = New-Object System.Drawing.Font 'Segoe UI Semibold', 20, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('Al Ammar Store', $title, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 330, 160)
$g.DrawString('Everyday essentials, delivered to your door', $tag, (New-Object System.Drawing.SolidBrush $Cream), 334, 250)
$g.DrawString(("CASH ON DELIVERY  {0}  ALL OVER PAKISTAN" -f [char]0x00B7), $small, (New-Object System.Drawing.SolidBrush $Gold), 336, 310)
$g.Dispose(); Save $bmp (Join-Path $Root 'android\play-store\feature-graphic.png')
