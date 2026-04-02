// import { useState, useRef, useCallback } from 'react';
// import { Device } from 'mediasoup-client';
// import io from 'socket.io-client';

// const SERVER_URL = 'http://localhost:3000'; 

// export const useMediasoup = () => {
//   const [localStream, setLocalStream] = useState(null);
//   const [poseData, setPoseData] = useState(null);
//   const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
//   // Refs ensure variables don't trigger re-renders
//   const socketRef = useRef(null);
//   const deviceRef = useRef(null);
//   const producerRef = useRef(null);
//   const transportRef = useRef(null);
//   const streamRef = useRef(null); // <--- NEW: Tracks stream without causing loops

//   const connect = useCallback(async () => {
//     try {
//       // Prevent double-connections
//       if (socketRef.current?.connected) return;

//       setConnectionStatus('connecting');
      
//       // 1. Connect to Node Server
//       socketRef.current = io(SERVER_URL);
      
//       socketRef.current.on('connect', () => {
//         console.log('✅ Connected to Signaling Server');
//       });

//       socketRef.current.on('poseData', (data) => {
//         setPoseData(data);
//         setConnectionStatus('connected');
//       });

//       // 2. Load Mediasoup Device
//       const routerRtpCapabilities = await new Promise((resolve) => {
//         socketRef.current.emit('getRouterRtpCapabilities', resolve);
//       });

//       deviceRef.current = new Device();
//       await deviceRef.current.load({ routerRtpCapabilities });

//       // 3. Create Transport
//       const transportInfo = await new Promise((resolve) => {
//         socketRef.current.emit('createWebRtcTransport', { sender: true }, resolve);
//       });

//       transportRef.current = deviceRef.current.createSendTransport(transportInfo);

//       transportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
//         socketRef.current.emit('connectWebRtcTransport', { dtlsParameters }, () => callback());
//       });

//       transportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
//         socketRef.current.emit('produce', { kind, rtpParameters }, ({ id }) => callback({ id }));
//       });

//       // 4. Get Camera (Standard Browser API)
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: false,
//         video: {
//           width: 640,
//           height: 480,
//           frameRate: 30,
//           facingMode: 'user'
//         }
//       });
      
//       // Save stream to Ref (for cleanup) AND State (for rendering)
//       streamRef.current = stream;
//       setLocalStream(stream);

//       // 5. Start Streaming
//       const track = stream.getVideoTracks()[0];
//       producerRef.current = await transportRef.current.produce({ track });

//       console.log('🚀 Streaming Video via Mediasoup!');

//     } catch (error) {
//       console.error('Mediasoup Error:', error);
//       setConnectionStatus('failed');
//     }
//   }, []);

//   const disconnect = useCallback(() => {
//     // Cleanup using Refs (won't trigger re-renders)
//     if (transportRef.current) {
//         transportRef.current.close();
//         transportRef.current = null;
//     }
//     if (socketRef.current) {
//         socketRef.current.disconnect();
//         socketRef.current = null;
//     }
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => track.stop());
//       streamRef.current = null;
//       setLocalStream(null);
//     }
//     setConnectionStatus('disconnected');
//   }, []); // <--- Dependency array is now EMPTY. No more loops.

//   return {
//     localStream,
//     connect,
//     disconnect,
//     connectionStatus,
//     poseData
//   };
// };

import { useState, useRef, useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

export const useMediasoup = () => {
  const [localStream, setLocalStream] = useState(null);
  const [poseData, setPoseData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerRef = useRef(null);
  const transportRef = useRef(null);
  const streamRef = useRef(null);
  const userIdRef = useRef(null);

  // Generate unique user ID
  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const connect = useCallback(async () => {
    try {
      if (socketRef.current?.connected) {
        console.log('⚠️ Already connected');
        return;
      }

      setConnectionStatus('connecting');

      // Generate user ID
      userIdRef.current = generateUserId();
      console.log(`👤 User ID: ${userIdRef.current}`);

      // 1. Connect to server
      socketRef.current = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true
      });

      socketRef.current.on('connect', async () => {
        console.log('✅ Socket connected:', socketRef.current.id);
        
        // Identify as browser client
        socketRef.current.emit('identify', {
          type: 'browser',
          userId: userIdRef.current
        });
      });

      // Listen for pose data meant for this user
      socketRef.current.on('poseData', ({ userId, data }) => {
        if (userId === userIdRef.current) {
          setPoseData(data);
          if (connectionStatus !== 'connected') {
            setConnectionStatus('connected');
          }
        }
      });

      socketRef.current.on('disconnect', () => {
        console.log('⚠️ Socket disconnected');
        setConnectionStatus('disconnected');
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        setConnectionStatus('failed');
      });

      // Wait for connection
      await new Promise((resolve) => {
        if (socketRef.current.connected) {
          resolve();
        } else {
          socketRef.current.once('connect', resolve);
        }
      });

      // 2. Load Mediasoup device
      console.log('📱 Loading Mediasoup device...');
      const routerRtpCapabilities = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout getting RTP capabilities')), 5000);
        socketRef.current.emit('getRouterRtpCapabilities', (caps) => {
          clearTimeout(timeout);
          resolve(caps);
        });
      });

      deviceRef.current = new Device();
      await deviceRef.current.load({ routerRtpCapabilities });
      console.log('✅ Device loaded');

      // 3. Create WebRTC send transport
      console.log('🚀 Creating WebRTC transport...');
      const transportInfo = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout creating transport')), 5000);
        socketRef.current.emit('createWebRtcTransport', { sender: true }, (info) => {
          clearTimeout(timeout);
          if (info.error) {
            reject(new Error(info.error));
          } else {
            resolve(info);
          }
        });
      });

      transportRef.current = deviceRef.current.createSendTransport(transportInfo);

      // Handle transport events
      transportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await new Promise((resolve, reject) => {
            socketRef.current.emit('connectWebRtcTransport', 
              { dtlsParameters }, 
              (response) => {
                if (response?.error) {
                  reject(new Error(response.error));
                } else {
                  resolve();
                }
              }
            );
          });
          callback();
          console.log('✅ Transport connected');
        } catch (error) {
          console.error('❌ Transport connect error:', error);
          errback(error);
        }
      });

      transportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await new Promise((resolve, reject) => {
            socketRef.current.emit('produce', 
              { kind, rtpParameters }, 
              (response) => {
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve(response);
                }
              }
            );
          });
          callback({ id });
          console.log(`✅ Producer created: ${id}`);
        } catch (error) {
          console.error('❌ Produce error:', error);
          errback(error);
        }
      });

      transportRef.current.on('connectionstatechange', (state) => {
        console.log(`🔄 Transport state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          setConnectionStatus('failed');
        }
      });

      // 4. Get camera stream
      console.log('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      setLocalStream(stream);
      console.log('✅ Camera stream obtained');

      // 5. Produce video track
      const videoTrack = stream.getVideoTracks()[0];
      const codec = deviceRef.current.rtpCapabilities.codecs.find(
        (c) => c.mimeType.toLowerCase() === 'video/vp8'
      );
      producerRef.current = await transportRef.current.produce({ 
        track: videoTrack,
        codec: codec,
        encodings: [
          { maxBitrate: 500000 } // Limit to 500kbps
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000
        }
      });

      console.log('🎥 Video producer started');
      console.log('⏳ Waiting for Python worker to connect...');

    } catch (error) {
      console.error('❌ Connection error:', error);
      setConnectionStatus('failed');
      
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  }, [connectionStatus]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');

    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }

    if (transportRef.current) {
      transportRef.current.close();
      transportRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setLocalStream(null);
    setPoseData(null);
    setConnectionStatus('disconnected');
    userIdRef.current = null;

    console.log('✅ Disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current?.connected) {
        disconnect();
      }
    };
  }, [disconnect]);

  return {
    localStream,
    connect,
    disconnect,
    connectionStatus,
    poseData,
    userId: userIdRef.current
  };
};