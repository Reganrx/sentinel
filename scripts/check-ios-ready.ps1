[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryPath = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repositoryPath 'SentinelBase.xcodeproj\project.pbxproj'
$schemePath = Join-Path $repositoryPath 'SentinelBase.xcodeproj\xcshareddata\xcschemes\SentinelBase.xcscheme'
$packageLockPath = Join-Path $repositoryPath 'SentinelBase.xcodeproj\project.xcworkspace\xcshareddata\swiftpm\Package.resolved'
$sourcePath = Join-Path $repositoryPath 'SentinelBase'
$cloudScript = Join-Path $repositoryPath 'ci_scripts\ci_post_clone.sh'

$requiredFiles = @($projectPath, $schemePath, $packageLockPath, $cloudScript)
$requiredFiles += @('SentinelBaseApp.swift', 'RootView.swift', 'SentinelAppModel.swift', 'SentinelCloud.swift', 'KeychainStore.swift', 'LiveTalkManager.swift') |
    ForEach-Object { Join-Path $sourcePath $_ }
$missing = $requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }
if ($missing) { throw "Missing required iOS files:`n$($missing -join "`n")" }

$project = Get-Content -Raw -LiteralPath $projectPath
if ($project -notmatch 'MARKETING_VERSION = 1\.2\.1;' -or
    $project -notmatch 'CURRENT_PROJECT_VERSION = ([0-9]+);' -or
    $project -notmatch 'PRODUCT_BUNDLE_IDENTIFIER = uk\.co\.sentinel\.base;' -or
    $project -notmatch 'DEVELOPMENT_TEAM = 9G2H3DAXFZ;') {
    throw 'The Xcode project identity does not match SentinelBase 1.2.1.'
}
$sourceBuild = [int]([regex]::Match($project, 'CURRENT_PROJECT_VERSION = ([0-9]+);').Groups[1].Value)
if ($sourceBuild -lt 8) { throw "The source build number $sourceBuild predates the build-8 handoff." }

$packageLock = Get-Content -Raw -LiteralPath $packageLockPath
if ($packageLock -notmatch 'stasel/WebRTC\.git' -or $packageLock -notmatch '152\.0\.0') {
    throw 'The pinned WebRTC package is missing or has changed unexpectedly.'
}

$cloud = Get-Content -Raw -LiteralPath (Join-Path $sourcePath 'SentinelCloud.swift')
foreach ($requiredSecurityMarker in @('X-Sentinel-Registration', 'updateRegistrationSecret', 'installationId', 'nativeAlias')) {
    if (-not $cloud.Contains($requiredSecurityMarker)) {
        throw "SentinelCloud is missing required security marker: $requiredSecurityMarker"
    }
}

$swiftFiles = Get-ChildItem -LiteralPath $sourcePath -Filter '*.swift' -File
$replacementCharacter = [char]0xFFFD
foreach ($file in $swiftFiles) {
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($file.FullName))
    if ($text.Contains($replacementCharacter)) { throw "Invalid UTF-8 replacement text found in $($file.Name)." }
}

Write-Host 'Sentinel iOS source is ready for Xcode Cloud.'
Write-Host "Source version: 1.2.1 ($sourceBuild); latest uploaded Xcode Cloud build: 9"
Write-Host 'Next TestFlight upload must use build 10 or higher.'
Write-Host 'Scheme:  SentinelBase'
Write-Host "Swift:   $($swiftFiles.Count) source files"
