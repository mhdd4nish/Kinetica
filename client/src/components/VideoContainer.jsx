import React from 'react';
import VideoPlayer from './VideoPlayer';

const VideoContainer = ({ localStream, remoteStreams, connectionStates }) => {
  return (
    <div className="videos-grid">
      {/* Local Video */}
      {localStream && (
        <div className="video-card local-video">
          <VideoPlayer 
            stream={localStream} 
            muted={true}
            label="You (Local)"
            isMirrored={true}
          />
        </div>
      )}
      
      {/* Remote Videos */}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
        const connectionState = connectionStates.get(peerId) || 'disconnected';
        
        return (
          <div key={peerId} className="video-card remote-video">
            <VideoPlayer 
              stream={stream}
              muted={false}
              label={`Peer: ${peerId.substring(0, 8)}...`}
            />
            <div className={`connection-badge ${connectionState}`}>
              {connectionState}
            </div>
          </div>
        );
      })}
      
      {/* Empty state */}
      {!localStream && remoteStreams.size === 0 && (
        <div className="empty-state">
         <div className="empty-state-icon">📹</div>
         <h3>No Active Streams</h3>
         <p>Start your camera to begin streaming</p>
         </div>
     )}
   </div>
 );
};

export default VideoContainer;