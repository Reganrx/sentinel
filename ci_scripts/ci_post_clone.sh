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
grep -q 'CURRENT_PROJECT_VERSION = 8;' "$PROJECT"

echo "SentinelBase 1.2.1 (8) source is ready for Xcode Cloud."
