param(
 [string]$NodePath=(Get-Command node.exe).Source,
 [string]$AdapterDependencies=$env:GRAFFITI_ADAPTER_DEPENDENCIES,
 [string]$PackagePath
)
$ErrorActionPreference='Stop'
$source=$PSScriptRoot
$package=if($PackagePath){[IO.Path]::GetFullPath($PackagePath)}else{Join-Path (Split-Path $source -Parent) 'MT-Graffiti-V3.2-Portable'}
$runtime=Join-Path $package 'runtime'
$dest=Join-Path $package 'app'
New-Item -ItemType Directory -Force $runtime,$dest | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtime 'node.exe') -Force
foreach($file in 'package.json','server.mjs','engine.mjs','studio.js','overlay.js','index.html','guide.html','overlay.html','studio.css','stage-layout.mjs','stage-art.mjs','asset-layout.mjs','scene-plan.mjs','v2.mjs'){
 Copy-Item -LiteralPath (Join-Path $source $file) -Destination $dest -Force
}
Copy-Item -LiteralPath (Join-Path $source 'HUONG-DAN.md') -Destination $package -Force
Copy-Item -LiteralPath (Join-Path $source 'v2') -Destination $dest -Recurse -Force
$adapterSource=Join-Path $source 'adapter'
$adapterTarget=Join-Path $dest 'adapter'
if(!$AdapterDependencies){
 $AdapterDependencies=Join-Path $adapterSource 'node_modules'
 $installed='E:/ChatGPT/Tiktok/shared/tiktok-live/node_modules'
 if(!(Test-Path -LiteralPath $AdapterDependencies) -and (Test-Path -LiteralPath $installed)){$AdapterDependencies=$installed}
}
if(!(Test-Path -LiteralPath $AdapterDependencies)){
 & npm.cmd ci --prefix $adapterSource --omit=dev
 if($LASTEXITCODE -ne 0){throw 'Không cài được thư viện kết nối TikTok.'}
 $AdapterDependencies=Join-Path $adapterSource 'node_modules'
}
New-Item -ItemType Directory -Force $adapterTarget,(Join-Path $adapterTarget 'node_modules') | Out-Null
foreach($file in 'direct-live.mjs','package.json','package-lock.json'){
 Copy-Item -LiteralPath (Join-Path $adapterSource $file) -Destination $adapterTarget -Force
}
Get-ChildItem -LiteralPath $AdapterDependencies -Force | ForEach-Object {
 Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $adapterTarget 'node_modules') -Recurse -Force
}
Push-Location $adapterTarget
try{
 & $NodePath --input-type=module -e "import {DirectLive} from './direct-live.mjs';import {TikTokLiveConnection} from 'tiktok-live-connector';if(typeof DirectLive!=='function'||typeof TikTokLiveConnection!=='function')process.exit(1);"
 if($LASTEXITCODE -ne 0){throw 'Kiểm tra adapter TikTok trong gói portable thất bại.'}
}finally{Pop-Location}
$exe=Join-Path $package 'MT Graffiti War V3.2.exe'
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /codepage:65001 /target:winexe "/out:$exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $source 'Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Không biên dịch được launcher Windows.'}
Write-Output $exe
