// module.exports = {
//   // Server settings
//   listenIp: '0.0.0.0',
//   listenPort: 3000,
  
//   // Mediasoup settings
//   mediasoup: {
//     // Number of mediasoup workers to launch
//     numWorkers: 1,
    
//     // Worker settings
//     worker: {
//       logLevel: 'warn',
//       logTags: [
//         'info',
//         'ice',
//         'dtls',
//         'rtp',
//         'srtp',
//         'rtcp',
//       ],
//       rtcMinPort: 40000,
//       rtcMaxPort: 49999,
//     },
    
//     // Router settings
//     router: {
//       mediaCodecs: [
//         {
//           kind: 'video',
//           mimeType: 'video/H264',
//           clockRate: 90000,
//           parameters: {
//             'packetization-mode': 1,
//             'profile-level-id': '42e01f',
//             'level-asymmetry-allowed': 1
//           }
//         }
//       ]
//     },
    
//     // WebRTC Transport settings (For React Client)
//     webRtcTransport: {
//       listenIps: [
//         {
//           ip: '0.0.0.0', // Listen on all interfaces
//           announcedIp: '127.0.0.1' // REPLACE WITH YOUR PC'S LAN IP (e.g. 192.168.1.5) FOR MOBILE
//         }
//       ],
//       initialAvailableOutgoingBitrate: 1000000,
//     },
    
//     // Plain Transport settings (For Python Script)
//     plainTransport: {
//       listenIp: {
//         ip: '0.0.0.0',
//         announcedIp: '127.0.0.1' // Localhost is fine for Python on same machine
//       },
//       rtcpMux: true,
//       comedia: false
//     }
//   }
// };
module.exports = {
  mediasoup: {
    worker: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          // ⚠️ IMPORTANT: VP8 must be FIRST to force the browser to use it.
          // Python's PyAV/OpenCV has much better support for VP8 than H264 in this context.
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        },
      ]
    },
    webRtcTransport: {
      listenIps: [{ ip: '127.0.0.1', announcedIp: null }], // Change announcedIp if deploying
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    },
    plainTransport: {
      listenIp: { ip: '127.0.0.1', announcedIp: null },
      rtcpMux: false, // Your python script doesn't support RTCP Mux
      comedia: false
    }
  }
};