// import React, { useRef, useEffect } from 'react';

// const RemoteVideo = ({ stream }) => {
//   const videoRef = useRef(null);

//   useEffect(() => {
//     // 1. Check if the video element and stream exist
//     if (!videoRef.current || !stream) {
//       console.log("RemoteVideo: Waiting for stream or video ref...");
//       return;
//     }

//     // 2. Log what tracks we are receiving (Audio/Video)
//     const videoTracks = stream.getVideoTracks();
//     const audioTracks = stream.getAudioTracks();
//     console.log(`RemoteVideo: Received stream with ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks.`);

//     if (videoTracks.length === 0) {
//       console.warn("RemoteVideo warning: No video tracks found in stream!");
//     }

//     // 3. Assign stream
//     videoRef.current.srcObject = stream;

//     // 4. Force Play
//     const playVideo = async () => {
//       try {
//         await videoRef.current.play();
//         console.log("RemoteVideo: Playback started successfully.");
//       } catch (err) {
//         console.error("RemoteVideo: Playback failed:", err);
//       }
//     };

//     playVideo();

//   }, [stream]);

//   return (
//     <div style={{ position: 'relative' }}>
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         // IMPORTANT: We mute it strictly to test if this fixes the black screen. 
//         // Browsers often block unmuted video from playing automatically.
//         muted={true} 
//         style={{ 
//           width: '100%', 
//           borderRadius: '8px', 
//           backgroundColor: '#222', // Dark grey background to see the box
//           minHeight: '200px'       // Force height so it doesn't collapse
//         }}
//       />
//       <div style={{
//         position: 'absolute', 
//         top: 5, 
//         left: 5, 
//         color: 'white', 
//         fontSize: '10px', 
//         background: 'rgba(0,0,0,0.5)',
//         padding: '2px'
//       }}>
//         DEBUG MODE
//       </div>
//     </div>
//   );
// };

// export default RemoteVideo;

import React, { useRef, useEffect } from 'react';

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Attempt to play automatically
      videoRef.current.play().catch(error => {
        console.error("Auto-play failed:", error);
      });
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      // We start muted to prevent feedback loops when testing on the same device.
      // You can change this to false if you are testing on different devices.
      muted={false} 
      style={{ 
        width: '100%', 
        borderRadius: '12px', 
        backgroundColor: '#2c3e50', // Dark blue-grey background
        objectFit: 'cover'          // Ensures video fills the card nicely
      }}
    />
  );
};

export default RemoteVideo;