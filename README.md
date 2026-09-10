# Sentinel Base for iPhone

This folder is the authoritative native SwiftUI iPhone project. Development can happen on
Windows; Xcode Cloud performs compilation, Apple signing and TestFlight delivery.

## Windows-to-TestFlight workflow

1. Edit the Swift source and project files in this repository.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/check-ios-ready.ps1`.
3. Commit and push to the iOS branch watched by Xcode Cloud.
4. Xcode Cloud verifies the project with `ci_scripts/ci_post_clone.sh`, archives the shared
   `SentinelBase` scheme and sends the build to TestFlight.

The prepared source setting is **1.2.1 (12)** and TestFlight currently has build 11.
Every later TestFlight upload must increment the project build number. The project uses
automatic signing for Apple team `9G2H3DAXFZ`, bundle ID `uk.co.sentinel.base`, and the
pinned `https://github.com/stasel/WebRTC.git` package at exact version `152.0.0`.
Do not restore versions 151.0.0 or 151.0.1: their referenced binary artifact is unavailable.

No Apple certificates, provisioning profiles, API keys, passwords or tokens belong in this
repository. Compatible content/configuration updates may continue through Sentinel Cloud;
native executable updates use Xcode Cloud and TestFlight.

Build 12 adds persistent mobile navigation, repaired Companion Sync permissions and cross-device diagnostics. Build 11 added native cross-page command routing for typed chat and Live Talk, plus secure
image generation through Sentinel Relay. Generated image files are stored locally with
iOS data protection and can be opened full screen or shared without exposing the OpenAI key.

Build 12 is prepared locally and must not be pushed until the App Store Connect API key,
Issuer ID, Key ID and Xcode Cloud Workflow ID have been confirmed in Sentinel Personal's
Release Module. Pushing this branch triggers the automatic Xcode Cloud workflow.
