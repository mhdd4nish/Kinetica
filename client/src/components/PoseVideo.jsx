// client/src/components/PoseVideo.jsx
import React, { useRef, useEffect } from 'react';
import { Pose } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';

const PoseVideo = ({ stream, isLocal = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const poseRef = useRef(null);

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    // Assign stream to video element
    videoRef.current.srcObject = stream;

    // Initialize MediaPipe Pose
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
    poseRef.current = pose;

    // Start detection loop
    const detectFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Send video frame to mediapipe
        await pose.send({ image: videoRef.current });
      }
      requestRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (poseRef.current) poseRef.current.close();
    };
  }, [stream]);

  const onResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !results.poseLandmarks) return;

    const ctx = canvas.getContext('2d');
    const width = video.videoWidth;
    const height = video.videoHeight;

    // Set canvas dimensions to match video
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optional: Draw the original video frame onto canvas 
    // (If you want to hide the <video> element and only show canvas)
    // ctx.drawImage(results.image, 0, 0, width, height);

    // Draw connectors (bones)
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: '#00FF00', 
      lineWidth: 4 
    });

    // Draw landmarks (joints)
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF0000', 
      lineWidth: 2 
    });

    ctx.restore();
  };

  return (
    <div className="video-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '640px' }}>
      {/* Hidden video element just for processing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        // muted={isLocal} // Mute local to avoid feedback
        style={{ 
          width: '100%', 
          height: 'auto',
          display: 'block', // Set to 'none' if you want to draw video on canvas instead
          transform: isLocal ? 'scaleX(-1)' : 'none' // Mirror effect for local user
        }}
        onLoadedMetadata={() => {
            videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
        }}
      />
      
      {/* Canvas overlay for drawing the skeleton */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none', // Let clicks pass through
          transform: isLocal ? 'scaleX(-1)' : 'none'
        }}
      />
    </div>
  );
};

export default PoseVideo;