param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$AndroidJar,
    [Parameter(Mandatory=$true)][string]$BuildTools,
    [Parameter(Mandatory=$true)][string]$BuildDirectory,
    [Parameter(Mandatory=$true)][string]$OutputApk
)
$ErrorActionPreference = 'Stop'
$gradleConfig = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'app/build.gradle') -Raw
$versionCode = [regex]::Match($gradleConfig, 'versionCode\s+(\d+)').Groups[1].Value
$versionName = [regex]::Match($gradleConfig, "versionName\s+'([^']+)'").Groups[1].Value
$sourceRoot = Join-Path $PSScriptRoot 'app\src\main'
$JavaHome = (Resolve-Path -LiteralPath $JavaHome).Path
$AndroidJar = (Resolve-Path -LiteralPath $AndroidJar).Path
$BuildTools = (Resolve-Path -LiteralPath $BuildTools).Path
New-Item -ItemType Directory -Force -Path $BuildDirectory | Out-Null
$BuildDirectory = (Resolve-Path -LiteralPath $BuildDirectory).Path
$OutputApk = [System.IO.Path]::GetFullPath($OutputApk)
New-Item -ItemType Directory -Force -Path (Join-Path $BuildDirectory 'classes'),(Join-Path $BuildDirectory 'dex') | Out-Null
function Run-Checked([string]$program,[string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "Build command failed: $program ($LASTEXITCODE)" }
}
$compiled = Join-Path $BuildDirectory 'resources.zip'
$unsigned = Join-Path $BuildDirectory 'unsigned.apk'
$aligned = Join-Path $BuildDirectory 'aligned.apk'
Run-Checked (Join-Path $BuildTools 'aapt2.exe') @('compile','--dir',(Join-Path $sourceRoot 'res'),'-o',$compiled)
Run-Checked (Join-Path $BuildTools 'aapt2.exe') @('link','-o',$unsigned,'-I',$AndroidJar,'--manifest',(Join-Path $sourceRoot 'AndroidManifest.xml'),'-A',(Join-Path $sourceRoot 'assets'),'--min-sdk-version','28','--target-sdk-version','35','--version-code',$versionCode,'--version-name',$versionName,$compiled)
$javaFiles = @(Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $JavaHome 'bin\javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$AndroidJar,'-d',(Join-Path $BuildDirectory 'classes')) + $javaFiles)
$classFiles = @(Get-ChildItem -LiteralPath (Join-Path $BuildDirectory 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $JavaHome 'bin\java.exe') (@('-cp',(Join-Path $BuildTools 'lib\d8.jar'),'com.android.tools.r8.D8','--min-api','28','--lib',$AndroidJar,'--output',(Join-Path $BuildDirectory 'dex')) + $classFiles)
Run-Checked (Join-Path $JavaHome 'bin\jar.exe') @('uf',$unsigned,'-C',(Join-Path $BuildDirectory 'dex'),'classes.dex')
Run-Checked (Join-Path $BuildTools 'zipalign.exe') @('-f','-p','4',$unsigned,$aligned)
$key = Join-Path $BuildDirectory 'campusday-local.keystore'
if (-not (Test-Path -LiteralPath $key)) {
    Run-Checked (Join-Path $JavaHome 'bin\keytool.exe') @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','campusday','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Campus Day Local Build, O=Campus Day, C=CA')
}
Run-Checked (Join-Path $JavaHome 'bin\java.exe') @('-jar',(Join-Path $BuildTools 'lib\apksigner.jar'),'sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$OutputApk,$aligned)
Run-Checked (Join-Path $JavaHome 'bin\java.exe') @('-jar',(Join-Path $BuildTools 'lib\apksigner.jar'),'verify','--verbose',$OutputApk)
Get-Item -LiteralPath $OutputApk | Select-Object Name,Length
Get-FileHash -LiteralPath $OutputApk -Algorithm SHA256

