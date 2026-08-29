# Sentinel Base for iPhone

This is a native SwiftUI iOS application. It is not a web wrapper.

## Build on a Mac

1. Install Xcode 16 or newer and XcodeGen (`brew install xcodegen`).
2. From this folder run `xcodegen generate`.
3. Open `SentinelBase.xcodeproj`, choose your Apple Developer team and confirm the bundle identifier.
4. Run on a registered iPhone, then create a TestFlight archive in Xcode Organizer.

Executable updates are distributed by TestFlight/App Store. Sentinel Cloud delivers platform-targeted signed content and configuration releases.
