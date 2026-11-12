param([string]$NodePath=(Get-Command node.exe).Source)
$ErrorActionPreference='Stop'
$source=$PSScriptRoot
$package=Join-Path (Split-Path $source -Parent) 'MT-Graffiti-V2.2.1-Lite-Portable'
$runtime=Join-Path $package 'runtime'
$dest=Join-Path $package 'app'
New-Item -ItemType Directory -Force $runtime,$dest | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtime 'node.exe') -Force
foreach($file in 'package.json','server.mjs','engine.mjs','studio.js','overlay.js','index.html','overlay.html','studio.css','stage-layout.mjs','stage-art.mjs','asset-layout.mjs','v2.mjs'){
 Copy-Item -LiteralPath (Join-Path $source $file) -Destination $dest -Force
}
Copy-Item -LiteralPath (Join-Path $source 'HUONG-DAN.md') -Destination $package -Force
Copy-Item -LiteralPath (Join-Path $source 'v2') -Destination $dest -Recurse -Force
$exe=Join-Path $package 'MT Graffiti War V2.2 Lite.exe'
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /codepage:65001 /target:winexe "/out:$exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $source 'Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Không biên dịch được launcher Windows.'}
Write-Output $exe
