import WebRTC

/// Build-time verification for the pinned native WebRTC dependency.
func verifyWebRTCDependency() {
    let factory = RTCPeerConnectionFactory()
    _ = factory
}
