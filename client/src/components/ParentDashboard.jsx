import React, { useState, useEffect } from 'react';
import { SettingsRepository, SessionRepository } from '../services/database';

// --- 1. THE PASSWORD GATE ---
const PasswordGate = ({ onUnlock, onBack }) => {
  const [mode, setMode] = useState('loading');
  const [input, setInput] = useState('');
  const [storedPassword, setStoredPassword] = useState(null);

  useEffect(() => {
    const existingPass = SettingsRepository.get('parent_password');
    if (existingPass) {
      setStoredPassword(existingPass);
      setMode('enter');
    } else {
      setMode('create');
    }
  }, []);

  const handleSubmit = () => {
    if (mode === 'create') {
      if (input.length < 4) {
        window.alert('Too Short: Password must be at least 4 numbers.');
        return;
      }
      SettingsRepository.set('parent_password', input);
      window.alert('Success: Password created! Remember it.');
      onUnlock(); // Go to dashboard
    } else if (mode === 'enter') {
      if (input === storedPassword) {
        onUnlock(); // Go to dashboard
      } else {
        window.alert('Wrong Password: Try again.');
        setInput('');
      }
    }
  };

  if (mode === 'loading') {
    return <div style={{ minHeight: '100vh', backgroundColor: '#2C3E50' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#2C3E50', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
        {mode === 'create' ? '🆕 Create Parent PIN' : '🔒 Parent Locked'}
      </h2>
      <p style={{ fontSize: '1.2rem', marginBottom: '40px', color: '#BDC3C7' }}>
        {mode === 'create' ? 'Set a PIN to protect the dashboard.' : 'Enter your PIN to continue.'}
      </p>

      <input
        type="password"
        maxLength={6}
        placeholder="Enter PIN"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ fontSize: '2rem', padding: '15px', borderRadius: '12px', border: 'none', textAlign: 'center', width: '250px', marginBottom: '30px', letterSpacing: '8px', outline: 'none' }}
      />

      <button onClick={handleSubmit} style={{ backgroundColor: '#E74C3C', border: 'none', padding: '15px 50px', fontSize: '1.5rem', color: 'white', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px', transition: 'transform 0.2s' }}>
        {mode === 'create' ? 'Set PIN' : 'Unlock'}
      </button>

      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#BDC3C7', fontSize: '1.2rem', cursor: 'pointer', textDecoration: 'underline' }}>
        Cancel
      </button>
    </div>
  );
};

// --- 2. THE DASHBOARD ---
const Dashboard = ({ onBack }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Load data from DB when dashboard opens
    const data = SessionRepository.getAllAsArray();
    setHistory(data);
  }, []);

  const totalSessions = history.length;
  const completedSessions = history.filter(s => s.completed === 1).length;

  const counts = {};
  history.forEach(h => {
    counts[h.activity_id] = (counts[h.activity_id] || 0) + 1;
  });
  const favorite = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'None';

  // Helper to match our specific web activity IDs to emojis
  const getIcon = (id) => {
    if (id === 'flamingo') return '🦩';
    if (id === 'frog_jumps') return '🐸';
    if (id === 'squat') return '🏋️';
    if (id === 'crawls') return '🐻';
    if (id === 'hands_up') return '🙌';
    return '🌟';
  };

  // Helper to format activity names beautifully
  const formatName = (id) => {
    if (!id) return 'Unknown';
    return id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F7FA', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', backgroundColor: 'white', padding: '20px 30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h1 style={{ margin: 0, color: '#2C3E50', fontSize: '2rem' }}>Parent Dashboard 📊</h1>
          <button onClick={onBack} style={{ padding: '10px 20px', fontSize: '1.1rem', backgroundColor: '#34495E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Close
          </button>
        </div>

        {/* Metrics Row [cite: 854] */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#E3F2FD', padding: '30px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#1565C0' }}>{totalSessions}</div>
            <div style={{ fontSize: '1.2rem', color: '#1976D2', marginTop: '5px', fontWeight: '600' }}>Total Sessions</div>
          </div>
          <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#E8F5E9', padding: '30px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#2E7D32' }}>{completedSessions}</div>
            <div style={{ fontSize: '1.2rem', color: '#388E3C', marginTop: '5px', fontWeight: '600' }}>Sessions Completed</div>
          </div>
          <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#FFF3E0', padding: '30px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E65100', marginTop: '20px', textTransform: 'uppercase' }}>{formatName(favorite)}</div>
            <div style={{ fontSize: '1.2rem', color: '#F57C00', marginTop: '10px', fontWeight: '600' }}>Favorite Activity</div>
          </div>
        </div>

        {/* Recent History List [cite: 855] */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0, color: '#2C3E50', borderBottom: '2px solid #ECF0F1', paddingBottom: '15px' }}>Recent History</h2>
          
          {history.length === 0 ? (
            <p style={{ color: '#7F8C8D', fontSize: '1.2rem', textAlign: 'center', padding: '40px 0' }}>No activities recorded yet. Time to play! 🏃‍♂️</p>
          ) : (
            history.slice(0, 10).map((session) => (
              <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #ECF0F1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontSize: '3rem', backgroundColor: '#F8F9FA', padding: '15px', borderRadius: '50%' }}>
                    {getIcon(session.activity_id)}
                  </span>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2C3E50' }}>
                      {formatName(session.activity_id)}
                      {session.completed === 0 && <span style={{ color: '#E74C3C', fontSize: '1rem', marginLeft: '12px', backgroundColor: '#FDEDEC', padding: '4px 8px', borderRadius: '4px' }}>Incomplete</span>}
                    </div>
                    <div style={{ color: '#7F8C8D', marginTop: '8px', fontSize: '1.1rem' }}>
                      {new Date(session.start_time).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2C3E50' }}>
                    {session.success_count} {['hands_up', 'flamingo'].includes(session.activity_id) ? 'Sec' : 'Reps'}
                  </div>
                  <div style={{ color: '#7F8C8D', marginTop: '8px', fontSize: '1.1rem' }}>
                    Took {Math.floor((session.end_time - session.start_time) / 1000)}s
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
      </div>
    </div>
  );
};

// --- 3. THE MAIN EXPORT WRAPPER ---
export default function ParentDashboardWrapper({ onBack }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Show the password gate if they haven't unlocked it yet
  if (!isUnlocked) {
    return <PasswordGate onUnlock={() => setIsUnlocked(true)} onBack={onBack} />;
  }

  // Show the dashboard if unlocked
  return <Dashboard onBack={onBack} />;
}