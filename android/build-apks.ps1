# build-apks.ps1 - builds the release apps into android\dist:
#   AlAmmarStore.aab  (upload this to Google Play)
#   AlAmmarStore.apk  (customer shop, for installing directly)
#   AlAmmarAdmin.apk  (opens the admin panel; share privately, not on Play)
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File android\build-apks.ps1
#
# Needs: the Android SDK with platform 36 (Android Studio's, in %LOCALAPPDATA%\Android\Sdk),
# JDK 17 and Gradle 8.11.1 in %USERPROFILE%\AndroidBuild (downloaded once if missing), and
# the signing key: android\signing\alammar-release.keystore + android\keystore.properties.
# Both are private, kept out of Git, and backed up to the owner's Google Drive. Without
# them Play will not accept updates, so never delete or regenerate them.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing

$Android = $PSScriptRoot
$Tools   = Join-Path $env:USERPROFILE 'AndroidBuild'
$Sdk     = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$Dist    = Join-Path $Android 'dist'

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Yellow }

if (-not (Test-Path (Join-Path $Sdk 'platforms\android-36'))) { throw "Android SDK platform 36 not found in $Sdk. Install it with Android Studio's SDK Manager." }
if (-not (Test-Path (Join-Path $Android 'keystore.properties'))) { throw "android\keystore.properties is missing. Restore the signing key from the Google Drive backup; do not create a new one." }
New-Item -ItemType Directory -Force $Tools, $Dist | Out-Null

# ---- JDK 17 + Gradle 8.11.1 -------------------------------------------------------------
function Ensure-Tool($url, $zipName, $folderFilter) {
    $found = Get-ChildItem $Tools -Directory -Filter $folderFilter -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
    $zip = Join-Path $Tools $zipName
    if (-not (Test-Path $zip)) { Write-Host "Downloading $url"; Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing }
    & tar.exe -xf $zip -C $Tools
    return (Get-ChildItem $Tools -Directory -Filter $folderFilter | Select-Object -First 1).FullName
}
Step 'JDK 17 and Gradle'
$JdkHome    = Ensure-Tool 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' 'jdk17.zip' 'jdk-17*'
$GradleHome = Ensure-Tool 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip' 'gradle-8.11.1-bin.zip' 'gradle-8.11.1'
$env:JAVA_HOME = $JdkHome
Set-Content -Path (Join-Path $Android 'local.properties') -Value ("sdk.dir=" + ($Sdk -replace '\\', '\\\\')) -Encoding ascii

# ---- launcher icons ---------------------------------------------------------------------
# Store: gold "A" on the brand green. Admin: the reverse, so the two are easy to tell apart.
function New-Icon($path, $size, $bg, $fg) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.Clear([System.Drawing.Color]::Transparent)
    $r = [int]($size * 0.22); $d = $r * 2
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shape.AddArc(0, 0, $d, $d, 180, 90); $shape.AddArc($size - $d - 1, 0, $d, $d, 270, 90)
    $shape.AddArc($size - $d - 1, $size - $d - 1, $d, $d, 0, 90); $shape.AddArc(0, $size - $d - 1, $d, $d, 90, 90)
    $shape.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($bg))), $shape)
    $font = New-Object System.Drawing.Font 'Georgia', ([single]($size * 0.58)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, ([single]($size * 0.03)), $size, $size
    $g.DrawString('A', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($fg))), $rect, $fmt)
    $g.Dispose(); New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
Step 'Launcher icons'
$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
$looks = @{ 'store' = @('#174F42', '#C9A45C'); 'admin' = @('#C9A45C', '#174F42') }
foreach ($flavor in $looks.Keys) {
    foreach ($density in $sizes.Keys) {
        $file = Join-Path $Android "app\src\$flavor\res\mipmap-$density\ic_launcher.png"
        New-Icon $file $sizes[$density] $looks[$flavor][0] $looks[$flavor][1]
    }
}

# ---- build ------------------------------------------------------------------------------
Step 'Building release apps (the first build downloads Android libraries and takes a few minutes)'
Push-Location $Android
try {
    & (Join-Path $GradleHome 'bin\gradle.bat') --no-daemon -q bundleStoreRelease assembleStoreRelease assembleAdminRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE)" }
} finally { Pop-Location }

$out = Join-Path $Android 'app\build\outputs'
Copy-Item (Join-Path $out 'bundle\storeRelease\app-store-release.aab') (Join-Path $Dist 'AlAmmarStore.aab') -Force
Copy-Item (Join-Path $out 'apk\store\release\app-store-release.apk') (Join-Path $Dist 'AlAmmarStore.apk') -Force
Copy-Item (Join-Path $out 'apk\admin\release\app-admin-release.apk') (Join-Path $Dist 'AlAmmarAdmin.apk') -Force
Step 'Done'
Get-ChildItem $Dist -File | ForEach-Object { "{0}  {1:N0} KB" -f $_.FullName, ($_.Length / 1KB) }
