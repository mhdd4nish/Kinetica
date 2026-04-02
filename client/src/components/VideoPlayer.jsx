import React, { useEffect, useRef, useState } from 'react';

const VideoPlayer = ({ stream, muted = false, label, isMirrored = false }) => {
  const videoRef = useRef(null);
  const [videoStats, setVideoStats] = useState({ width: 0, height: 0, fps: 0 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    // Update video stats
    const updateStats = () => {
      if (videoRef.current && stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          setVideoStats({
            width: settings.width || 0,
            height: settings.height || 0,
            fps: settings.frameRate || 0
          });
        }
      }
    };

    const interval = setInterval(updateStats, 1000);
    updateStats();

    return () => clearInterval(interval);
  }, [stream]);

  return (
    <div className="video-player-container">
      <div className="video-header">
        <span className="video-label">{label}</span>
        <div className="video-indicators">
          {stream && stream.active && (
            <span className="live-indicator">● LIVE</span>
          )}
        </div>
      </div>
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`video-element ${isMirrored ? 'mirrored' : ''}`}
      />
      
      <div className="video-stats">
        <span>{videoStats.width}x{videoStats.height}</span>
        <span>{videoStats.fps} FPS</span>
      </div>
    </div>
  );
};

export default VideoPlayer;