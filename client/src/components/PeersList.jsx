import React, { useState } from 'react';

const PeersList = ({ 
  availablePeers, 
  connectedPeers, 
  onConnectToPeer, 
  onDisconnectFromPeer,
  connectionStates 
}) => {
  const [expandedPeers, setExpandedPeers] = useState(new Set());

  const togglePeerExpanded = (peerId) => {
    setExpandedPeers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(peerId)) {
        newSet.delete(peerId);
      } else {
        newSet.add(peerId);
      }
      return newSet;
    });
  };

  const isConnected = (peerId) => {
    return connectedPeers.has(peerId);
  };

  const getConnectionState = (peerId) => {
    return connectionStates.get(peerId) || 'disconnected';
  };

  if (availablePeers.length === 0) {
    return (
      <div className="peers-list empty">
        <div className="empty-peers-icon">👥</div>
        <p>No other peers online</p>
        <small>Open this app in another tab or device</small>
      </div>
    );
  }

  return (
    <div className="peers-list">
      <div className="peers-header">
        <h3>
          <span className="header-icon">👥</span>
          Available Peers ({availablePeers.length})
        </h3>
      </div>

      <div className="peers-grid">
        {availablePeers.map(peerId => {
          const connected = isConnected(peerId);
          const state = getConnectionState(peerId);
          const expanded = expandedPeers.has(peerId);

          return (
            <div key={peerId} className={`peer-card ${connected ? 'connected' : ''}`}>
              <div className="peer-header">
                <div className="peer-info">
                  <div className="peer-id">
                    <span className="peer-icon">🔵</span>
                    {peerId.substring(0, 12)}...
                  </div>
                  <div className={`peer-status ${state}`}>
                    <span className="status-dot"></span>
                    {state}
                  </div>
                </div>

                <button
                  onClick={() => togglePeerExpanded(peerId)}
                  className="btn-icon-small"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? '▼' : '▶'}
                </button>
              </div>

              {expanded && (
                <div className="peer-details">
                  <div className="peer-detail-item">
                    <span className="detail-label">Peer ID:</span>
                    <span className="detail-value">{peerId}</span>
                  </div>
                  <div className="peer-detail-item">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{state}</span>
                  </div>
                </div>
              )}

              <div className="peer-actions">
                {!connected ? (
                  <button
                    onClick={() => onConnectToPeer(peerId)}
                    disabled={state === 'connecting'}
                    className="btn btn-primary btn-small"
                  >
                    <span className="btn-icon">🔗</span>
                    {state === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                ) : (
                  <button
                    onClick={() => onDisconnectFromPeer(peerId)}
                    className="btn btn-danger btn-small"
                  >
                    <span className="btn-icon">🔌</span>
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeersList;