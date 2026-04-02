import React from 'react';

const StatusBar = ({ isConnected, socketId, error, statusMessage }) => {
  const getStatusClass = () => {
    if (error) return 'status-error';
    if (!isConnected) return 'status-warning';
    return 'status-success';
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (!isConnected) return '⚠️';
    return '✅';
  };

  return (
    <div className={`status-bar ${getStatusClass()}`}>
      <div className="status-content">
        <span className="status-icon">{getStatusIcon()}</span>
        <div className="status-text">
          <strong>Status:</strong> 
          {error ? (
            <span className="error-message">{error}</span>
          ) : (
            <span>{statusMessage || (isConnected ? 'Connected' : 'Disconnected')}</span>
          )}
        </div>
      </div>

      {isConnected && socketId && (
        <div className="status-info">
          <span className="info-label">Your ID:</span>
          <span className="info-value">{socketId.substring(0, 12)}...</span>
        </div>
      )}

      <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        <span className="indicator-dot"></span>
      </div>
    </div>
  );
};

export default StatusBar;