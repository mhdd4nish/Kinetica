import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';

const ChatPanel = ({ socket, socketId, isConnected, peers }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset unread count when panel is opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data) => {
      const newMessage = {
        id: Date.now() + Math.random(),
        senderId: data.senderId,
        senderName: data.senderName || data.senderId.substring(0, 8),
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        type: 'received'
      };

      setMessages(prev => [...prev, newMessage]);

      // Increment unread count if panel is closed
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }

      // Play notification sound (optional)
      playNotificationSound();
    };

    const handleSystemMessage = (data) => {
      const systemMessage = {
        id: Date.now() + Math.random(),
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        type: 'system'
      };

      setMessages(prev => [...prev, systemMessage]);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('system-message', handleSystemMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('system-message', handleSystemMessage);
    };
  }, [socket, isOpen]);

  // Play notification sound
  const playNotificationSound = () => {
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Audio notification not supported');
    }
  };

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || !socket || !isConnected) return;

    const message = {
      id: Date.now() + Math.random(),
      senderId: socketId,
      senderName: 'You',
      text: inputMessage.trim(),
      timestamp: Date.now(),
      type: 'sent'
    };

    // Add to local messages
    setMessages(prev => [...prev, message]);

    // Send to server
    socket.emit('chat-message', {
      text: message.text,
      timestamp: message.timestamp,
      senderId: socketId
    });

    // Clear input
    setInputMessage('');

    // Focus back on input
    inputRef.current?.focus();
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Toggle panel
  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  // Clear chat
  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      setMessages([]);
      setUnreadCount(0);
    }
  };

  console.log("ChatPanel is:", ChatPanel);

  return (
    <>
      {/* Chat Toggle Button */}
      <button 
        className={`chat-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={togglePanel}
        title="Toggle Chat"
      >
        <span className="chat-icon">💬</span>
        {unreadCount > 0 && (
          <span className="chat-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Chat Panel */}
      <div className={`chat-panel ${isOpen ? 'open' : 'closed'}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-content">
            <span className="chat-title">
              <span className="chat-title-icon">💬</span>
              Chat
            </span>
            <span className="chat-status">
              {isConnected ? (
                <>
                  <span className="status-dot online"></span>
                  {peers.size} peer(s) online
                </>
              ) : (
                <>
                  <span className="status-dot offline"></span>
                  Offline
                </>
              )}
            </span>
          </div>
          
          <div className="chat-header-actions">
            <button 
              className="chat-action-btn"
              onClick={handleClearChat}
              title="Clear chat"
              disabled={messages.length === 0}
            >
              🗑️
            </button>
            <button 
              className="chat-action-btn"
              onClick={togglePanel}
              title="Close chat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="empty-icon">💬</div>
              <p>No messages yet</p>
              <small>Start a conversation with your peers</small>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`chat-message ${message.type}`}
                >
                  {message.type === 'system' ? (
                    <div className="system-message">
                      <span className="system-icon">ℹ️</span>
                      <span className="system-text">{message.text}</span>
                    </div>
                  ) : (
                    <>
                      <div className="message-header">
                        <span className="message-sender">
                          {message.type === 'sent' ? 'You' : message.senderName}
                        </span>
                        <span className="message-time">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <div className="message-bubble">
                        <p className="message-text">{message.text}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Form */}
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={isConnected ? "Type a message..." : "Connect to send messages"}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isConnected}
              maxLength={500}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!inputMessage.trim() || !isConnected}
              title="Send message"
            >
              <span className="send-icon">📤</span>
            </button>
          </div>
          {inputMessage.length > 400 && (
            <div className="char-count">
              {inputMessage.length}/500
            </div>
          )}
        </form>

        {/* Connection Warning */}
        {!isConnected && (
          <div className="chat-warning">
            ⚠️ Not connected to server
          </div>
        )}
      </div>
    </>
  );
};

export default ChatPanel;