// import { useState, useCallback, useEffect } from 'react';
// import webrtcService from '../services/webrtcService';

// export const useWebRTC = (socket, localStream) => {
//   const [peers, setPeers] = useState(new Map());
//   const [remoteStreams, setRemoteStreams] = useState(new Map());
//   const [connectionStates, setConnectionStates] = useState(new Map());

//   // Update connection state for a peer
//   const updateConnectionState = useCallback((peerId, state) => {
//     setConnectionStates(prev => new Map(prev).set(peerId, state));
//   }, []);

//   // Add remote stream
//   const addRemoteStream = useCallback((peerId, stream) => {
//     setRemoteStreams(prev => {
//       const newMap = new Map(prev);
//       newMap.set(peerId, stream);
//       return newMap;
//     });
//     console.log('📺 Added remote stream for:', peerId);
//   }, []);

//   // Remove remote stream
//   const removeRemoteStream = useCallback((peerId) => {
//     setRemoteStreams(prev => {
//       const newMap = new Map(prev);
//       newMap.delete(peerId);
//       return newMap;
//     });
//     updateConnectionState(peerId, 'disconnected');
//     console.log('🗑️ Removed remote stream for:', peerId);
//   }, [updateConnectionState]);

//   // Connect to peer
//   const connectToPeer = useCallback(async (peerId) => {
//     if (!socket || !localStream) {
//       console.error('Socket or local stream not available');
//       return;
//     }

//     try {
//       updateConnectionState(peerId, 'connecting');

//       await webrtcService.createOffer(peerId, {
//         onTrack: (stream) => {
//           addRemoteStream(peerId, stream);
//         },
//         onConnectionStateChange: (state) => {
//           updateConnectionState(peerId, state);
//           if (state === 'disconnected' || state === 'failed' || state === 'closed') {
//             removeRemoteStream(peerId);
//           }
//         }
//       });

//       setPeers(prev => new Map(prev).set(peerId, { id: peerId, connectedAt: new Date() }));
//       console.log('✅ Connected to peer:', peerId);
//     } catch (error) {
//       console.error('Error connecting to peer:', error);
//       updateConnectionState(peerId, 'failed');
//     }
//   }, [socket, localStream, addRemoteStream, updateConnectionState, removeRemoteStream]);

//   // Disconnect from peer
//   const disconnectFromPeer = useCallback((peerId) => {
//     webrtcService.closePeerConnection(peerId);
//     setPeers(prev => {
//       const newMap = new Map(prev);
//       newMap.delete(peerId);
//       return newMap;
//     });
//     removeRemoteStream(peerId);
//     console.log('🔌 Disconnected from peer:', peerId);
//   }, [removeRemoteStream]);

//   // Disconnect from all peers
//   const disconnectAll = useCallback(() => {
//     webrtcService.closeAllConnections();
//     setPeers(new Map());
//     setRemoteStreams(new Map());
//     setConnectionStates(new Map());
//     console.log('🔌 Disconnected from all peers');
//   }, []);

//   // Get peer stats
//   const getPeerStats = useCallback(async (peerId) => {
//     return await webrtcService.getStats(peerId);
//   }, []);

//   // Setup socket listeners
//   useEffect(() => {
//     if (!socket || !localStream) return;

//     webrtcService.setSocket(socket);
//     webrtcService.setLocalStream(localStream);

//     // Handle incoming offer
//     const handleOffer = async (data) => {
//       try {
//         updateConnectionState(data.sender, 'connecting');

//         await webrtcService.handleOffer(data, {
//           onTrack: (stream) => {
//             addRemoteStream(data.sender, stream);
//           },
//           onConnectionStateChange: (state) => {
//             updateConnectionState(data.sender, state);
//             if (state === 'disconnected' || state === 'failed' || state === 'closed') {
//               removeRemoteStream(data.sender);
//             }
//           }
//         });

//         setPeers(prev => new Map(prev).set(data.sender, { 
//           id: data.sender, 
//           connectedAt: new Date() 
//         }));
//       } catch (error) {
//         console.error('Error handling offer:', error);
//         updateConnectionState(data.sender, 'failed');
//       }
//     };

//     // Handle incoming answer
//     const handleAnswer = async (data) => {
//       try {
//         await webrtcService.handleAnswer(data);
//         updateConnectionState(data.sender, 'connected');
//       } catch (error) {
//         console.error('Error handling answer:', error);
//       }
//     };

//     // Handle ICE candidate
//     const handleIceCandidate = async (data) => {
//       try {
//         await webrtcService.handleIceCandidate(data);
//       } catch (error) {
//         console.error('Error handling ICE candidate:', error);
//       }
//     };

//     // Handle peer disconnection
//     const handlePeerDisconnected = (peerId) => {
//       disconnectFromPeer(peerId);
//     };

//     socket.on('offer', handleOffer);
//     socket.on('answer', handleAnswer);
//     socket.on('ice-candidate', handleIceCandidate);
//     socket.on('peer-disconnected', handlePeerDisconnected);

//     return () => {
//       socket.off('offer', handleOffer);
//       socket.off('answer', handleAnswer);
//       socket.off('ice-candidate', handleIceCandidate);
//       socket.off('peer-disconnected', handlePeerDisconnected);
//     };
//   }, [socket, localStream, addRemoteStream, updateConnectionState, removeRemoteStream, disconnectFromPeer]);

//   return {
//     peers,
//     remoteStreams,
//     connectionStates,
//     connectToPeer,
//     disconnectFromPeer,
//     disconnectAll,
//     getPeerStats
//   };
// };

import { useState, useCallback, useRef, useEffect } from 'react';

export const useWebRTC = (localStream) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [poseData, setPoseData] = useState(null);
  const peerConnectionRef = useRef(null);

  const connectToServer = useCallback(async () => {
    // Safety check: Don't try if camera isn't ready
    if (!localStream) {
      console.warn("⚠️ Camera not ready yet. Skipping connection attempt.");
      return;
    }

    try {
      setConnectionStatus('connecting');
      console.log("🚀 Starting connection to Python Server...");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Add local camera tracks to the connection
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Setup Data Channel for receiving AI results
      const dc = pc.createDataChannel("pose-data");
      dc.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setPoseData(data);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait briefly for ICE candidates
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send offer to Python
      const response = await fetch('http://localhost:8080/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription.sdp,
          type: pc.localDescription.type,
        }),
      });

      if (!response.ok) throw new Error("Server rejected offer");

      const answer = await response.json();
      await pc.setRemoteDescription(answer);

      setConnectionStatus('connected');
      console.log("✅ Connected to Pose Detection Server!");

    } catch (error) {
      console.error("❌ Connection failed:", error);
      setConnectionStatus('failed');
    }
  }, [localStream]);

  const disconnect = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setConnectionStatus('disconnected');
    setPoseData(null);
  }, []);

  return {
    connectToServer,
    disconnect,
    connectionStatus,
    poseData
  };
};