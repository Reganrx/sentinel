# Sentinel Base for iPhone

This folder is the authoritative native SwiftUI iPhone project. Development can happen on
Windows; Xcode Cloud performs compilation, Apple signing and TestFlight delivery.

## Windows-to-TestFlight workflow

1. Edit the Swift source and project files in this repository.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/check-ios-ready.ps1`.
3. Commit and push to the iOS branch watched by Xcode Cloud.
4. Xcode Cloud verifies the project with `ci_scripts/ci_post_clone.sh`, archives the shared
   `SentinelBase` scheme and sends the build to TestFlight.

The current source is **1.2.1 (8)**, following approved TestFlight build 7. The project uses
automatic signing for Apple team `9G2H3DAXFZ`, bundle ID `uk.co.sentinel.base`, and the
pinned owned WebRTC package at version `151.0.0`.

No Apple certificates, provisioning profiles, API keys, passwords or tokens belong in this
repository. Compatible content/configuration updates may continue through Sentinel Cloud;
native executable updates use Xcode Cloud and TestFlight.
