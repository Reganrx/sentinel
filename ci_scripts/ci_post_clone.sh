#!/bin/sh
set -eu

REPOSITORY_PATH="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"
PROJECT="$REPOSITORY_PATH/SentinelBase.xcodeproj/project.pbxproj"
SCHEME="$REPOSITORY_PATH/SentinelBase.xcodeproj/xcshareddata/xcschemes/SentinelBase.xcscheme"
PACKAGE_LOCK="$REPOSITORY_PATH/SentinelBase.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

test -f "$PROJECT"
test -f "$SCHEME"
test -f "$PACKAGE_LOCK"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = uk.co.sentinel.base;' "$PROJECT"
grep -Eq 'CURRENT_PROJECT_VERSION = (1[1-9]|[2-9][0-9]+);' "$PROJECT"
grep -q 'repositoryURL = "https://github.com/stasel/WebRTC.git";' "$PROJECT"
grep -q 'version = 152.0.0;' "$PROJECT"

echo "SentinelBase source and WebRTC 152.0.0 are ready for Xcode Cloud."
