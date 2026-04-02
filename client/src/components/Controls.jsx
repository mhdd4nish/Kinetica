import React, { useState } from 'react';

const Controls = ({ 
  isStreaming, 
  onStartCamera, 
  onStopCamera, 
  onToggleAudio, 
  onToggleVideo,
  devices,
  onSwitchCamera
}) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState('');

  const handleToggleAudio = () => {
    const enabled = onToggleAudio();
    setIsAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = onToggleVideo();
    setIsVideoEnabled(enabled);
  };

  const handleDeviceChange = (e) => {
    const deviceId = e.target.value;
    setSelectedDevice(deviceId);
    onSwitchCamera(deviceId);
  };

  return (
    <div className="controls-panel">
      <div className="controls-group">
        <button 
          onClick={onStartCamera}
          disabled={isStreaming}
          className="btn btn-primary"
          title="Start Camera"
        >
          <span className="btn-icon">📹</span>
          <span className="btn-text">Start Camera</span>
        </button>

        <button 
          onClick={onStopCamera}
          disabled={!isStreaming}
          className="btn btn-danger"
          title="Stop Camera"
        >
          <span className="btn-icon">⏹️</span>
          <span className="btn-text">Stop Camera</span>
        </button>

        {isStreaming && (
          <>
            <button 
              onClick={handleToggleAudio}
              className={`btn ${isAudioEnabled ? 'btn-success' : 'btn-warning'}`}
              title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              <span className="btn-icon">{isAudioEnabled ? '🎤' : '🔇'}</span>
              <span className="btn-text">{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
            </button>

            <button 
              onClick={handleToggleVideo}
              className={`btn ${isVideoEnabled ? 'btn-success' : 'btn-warning'}`}
              title={isVideoEnabled ? 'Disable Video' : 'Enable Video'}
            >
              <span className="btn-icon">{isVideoEnabled ? '📷' : '🚫'}</span>
              <span className="btn-text">{isVideoEnabled ? 'Video On' : 'Video Off'}</span>
            </button>
          </>
        )}
      </div>

      {isStreaming && devices.length > 1 && (
        <div className="device-selector">
          <label htmlFor="camera-select">
            <span className="label-icon">🎥</span>
            Camera:
          </label>
          <select 
            id="camera-select"
            value={selectedDevice}
            onChange={handleDeviceChange}
            className="device-select"
          >
            <option value="">Default Camera</option>
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default Controls;