// WebRTC configuration
const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };
  
  class WebRTCService {
    constructor() {
      this.peerConnections = new Map();
      this.localStream = null;
      this.socket = null;
    }
  
    // Initialize socket connection
    setSocket(socket) {
      this.socket = socket;
    }
  
    // Set local stream
    setLocalStream(stream) {
      this.localStream = stream;
    }
  
    // Create peer connection
    createPeerConnection(peerId, callbacks = {}) {
      const {
        onTrack,
        onIceCandidate,
        onConnectionStateChange
      } = callbacks;
  
      const peerConnection = new RTCPeerConnection(configuration);
  
      // Add local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream);
        });
      }
  
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          console.log('🧊 Sending ICE candidate to:', peerId);
          this.socket.emit('ice-candidate', {
            target: peerId,
            candidate: event.candidate
          });
          
          if (onIceCandidate) {
            onIceCandidate(event.candidate);
          }
        }
      };
  
      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        console.log('📺 Received remote track from:', peerId);
        if (onTrack) {
          onTrack(event.streams[0]);
        }
      };
  
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
        
        if (onConnectionStateChange) {
          onConnectionStateChange(peerConnection.connectionState);
        }
  
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'closed') {
          this.closePeerConnection(peerId);
        }
      };
  
      // Handle ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${peerId}:`, peerConnection.iceConnectionState);
      };
  
      this.peerConnections.set(peerId, peerConnection);
      return peerConnection;
    }
  
    // Create and send offer
    async createOffer(peerId, callbacks) {
      try {
        const peerConnection = this.createPeerConnection(peerId, callbacks);
        
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(offer);
        
        console.log('📤 Sending offer to:', peerId);
        this.socket.emit('offer', {
          target: peerId,
          sdp: offer
        });
  
        return peerConnection;
      } catch (error) {
        console.error('Error creating offer:', error);
        throw error;
      }
    }
  
    // Handle incoming offer
    async handleOffer(data, callbacks) {
      try {
        const peerConnection = this.createPeerConnection(data.sender, callbacks);
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('📥 Sending answer to:', data.sender);
        this.socket.emit('answer', {
          target: data.sender,
          sdp: answer
        });
  
        return peerConnection;
      } catch (error) {
        console.error('Error handling offer:', error);
        throw error;
      }
    }
  
    // Handle incoming answer
    async handleAnswer(data) {
      try {
        const peerConnection = this.peerConnections.get(data.sender);
        
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log('✅ Answer set for:', data.sender);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
        throw error;
      }
    }
  
    // Handle ICE candidate
    async handleIceCandidate(data) {
      try {
        const peerConnection = this.peerConnections.get(data.sender);
        
        if (peerConnection && data.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('✅ ICE candidate added for:', data.sender);
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  
    // Get peer connection
    getPeerConnection(peerId) {
      return this.peerConnections.get(peerId);
    }
  
    // Close peer connection
    closePeerConnection(peerId) {
      const peerConnection = this.peerConnections.get(peerId);
      
      if (peerConnection) {
        peerConnection.close();
        this.peerConnections.delete(peerId);
        console.log('🔌 Closed connection with:', peerId);
      }
    }
  
    // Close all connections
    closeAllConnections() {
      this.peerConnections.forEach((pc, peerId) => {
        pc.close();
      });
      this.peerConnections.clear();
      console.log('🔌 Closed all peer connections');
    }
  
    // Get connection stats
    async getStats(peerId) {
      const peerConnection = this.peerConnections.get(peerId);
      if (!peerConnection) return null;
  
      const stats = await peerConnection.getStats();
      const result = {
        video: {},
        audio: {},
        connection: {}
      };
  
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          if (report.kind === 'video') {
            result.video = {
              bytesReceived: report.bytesReceived,
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost,
              framesReceived: report.framesReceived,
              framesDecoded: report.framesDecoded,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              framesPerSecond: report.framesPerSecond
            };
          } else if (report.kind === 'audio') {
            result.audio = {
              bytesReceived: report.bytesReceived,
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost
            };
          }
        }
  
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.connection = {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            availableIncomingBitrate: report.availableIncomingBitrate
          };
        }
      });
  
      return result;
    }
  }
  
  export default new WebRTCService();