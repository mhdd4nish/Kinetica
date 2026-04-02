
import React, { useEffect, useRef, useState } from 'react';
import { useMediasoup } from './hooks/useMediasoup';
import Controls from './components/Controls';
import StatusBar from './components/StatusBar';
import PoseCanvas from './components/PoseCanvas';
import ActivityCatalog from './components/ActivityCatalog';
import InstructionsScreen from './components/InstructionsScreen'; 
import ParentDashboardWrapper from './components/ParentDashboard'; 
import { SessionRepository } from './services/database';
import './App.css';

function App() {
  const { 
    localStream, connect, disconnect, connectionStatus, poseData 
  } = useMediasoup();

  const videoRef = useRef(null);
  const isStreaming = !!localStream;

  // --- NAVIGATION STATE ---
  const [currentView, setCurrentView] = useState('catalog'); 
  const [selectedActivity, setSelectedActivity] = useState(null);

  // --- LOCAL SCORING STATE ---
  const [localScore, setLocalScore] = useState(0);
  const [handsRaisedTime, setHandsRaisedTime] = useState(0);
  const [flamingoTime, setFlamingoTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const isDeepSquatting = useRef(false); 
  const isJumping = useRef(false);
  const lastFrameTime = useRef(Date.now());
  const gracePeriodTimer = useRef(0);

  const saveToDB = (score, isComplete) => {
    if (!selectedActivity) return;
    
    let finalScore = score;
    if (selectedActivity === 'hands_up') finalScore = Math.floor(handsRaisedTime);
    if (selectedActivity === 'flamingo') finalScore = Math.floor(flamingoTime);
    const sessionData = {
      id: Date.now().toString(),
      child_id: 'child_1', // Default profile ID
      activity_id: selectedActivity,
      start_time: sessionStartTime,
      end_time: Date.now(),
      success_count: finalScore,
      anomaly_count: 0, 
      completed: isComplete
    };
    
    SessionRepository.create(sessionData);
  };

  // 1. Catalog -> Instructions
  const handleSelectActivity = (activityId) => {
    setSelectedActivity(activityId);
    setCurrentView('instructions'); // 🟢 CHANGED: Go to ghost demo first
  };

  // 2. Instructions -> Game
  const handleStartPractice = () => {
    setCurrentView('game');
    if (!localStream && connectionStatus === 'disconnected') {
        connect();
    }
    
    // Reset Score
    setLocalScore(0);
    setHandsRaisedTime(0); 
    setFlamingoTime(0);
    lastFrameTime.current = Date.now(); 
    setSessionStartTime(Date.now());
    isDeepSquatting.current = false;
    isJumping.current = false;
    gracePeriodTimer.current = 0;
  };

  // 3. Any -> Catalog
  const handleBackToMenu = () => {
    if (currentView === 'game' && (localScore > 0 || handsRaisedTime > 0)) {
      saveToDB(localScore, 0); 
    }
    disconnect(); 
    setCurrentView('catalog');
    setSelectedActivity(null);
  };

  const handleMissionComplete = () => {
    // 🟢 Save as complete!
    saveToDB(localScore, 1);
    disconnect();
    setCurrentView('catalog');
    setSelectedActivity(null);
  };

  // --- SMART COUNTER LOGIC ---
  useEffect(() => {
    if (!poseData || !poseData.action) return;
    const action = poseData.action;

    const now = Date.now();
    
    // Calculate time since last frame (cap at 1 second to prevent background-tab cheating)
    let dt = (now - lastFrameTime.current) / 1000;
    if (dt > 1) dt = 0.1; 
    lastFrameTime.current = now;

    // 1. SQUAT LOGIC (Target: 5)
    if (selectedActivity === 'squat') {
      if (action.includes("Deep Squat")) isDeepSquatting.current = true;
      if (action === "Standing" && isDeepSquatting.current) {
        setLocalScore((prev) => (prev < 5 ? prev + 1 : prev)); // 🟢 Changed back to 5
        isDeepSquatting.current = false; 
      }
    }
    
    // 2. JUMP LOGIC (Target: 5)
    if (selectedActivity === 'frog_jumps') {
      if (action.includes("JUMP") && !isJumping.current) {
        setLocalScore((prev) => (prev < 5 ? prev + 1 : prev));
        isJumping.current = true; 
      }
      if (!action.includes("JUMP")) {
        isJumping.current = false; 
      }
    }

    // 3. HANDS RAISED LOGIC (Target: 10 Seconds)
    if (selectedActivity === 'hands_up') {
      if (action.includes("Hands Raised")) {
        // Add fraction of a second to the timer, cap it at 10
        setHandsRaisedTime(prev => prev >= 10 ? prev : Math.min(prev + dt, 10)); 
        gracePeriodTimer.current = 0; 
      } else {
        gracePeriodTimer.current += dt;
        if (gracePeriodTimer.current > 0.5) { 
          setHandsRaisedTime(prev => prev >= 10 ? prev : 0); 
        }
      }
    }
    if (selectedActivity === 'flamingo') {
      if (action.includes("One Foot!")) {
        setFlamingoTime(prev => prev >= 10 ? prev : Math.min(prev + dt, 10)); 
        gracePeriodTimer.current = 0; 
      } else {
        gracePeriodTimer.current += dt;
        if (gracePeriodTimer.current > 0.5) { 
          setFlamingoTime(prev => prev >= 10 ? prev : 0); 
        }
      }
    }
  }, [poseData, selectedActivity]);

  // --- HANDLERS ---
  const handleStartCamera = async () => { await connect(); };
  const handleStopSystem = () => { disconnect(); };
  
  useEffect(() => {
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream;
  }, [localStream]);

  return (
    <div className="app">
      {currentView !== 'instructions' && (
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">
               {currentView === 'game' && (
                 <button onClick={handleBackToMenu} style={{ marginRight: '15px', padding: '5px 10px', fontSize: '1.2rem', backgroundColor: "#374dafff", border: '2px solid white', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
                   ⬅️ Menu
                 </button>
               )}
               <span className="title-icon">🧠</span>Kinetica
            </h1>
            {currentView === 'catalog' && (
               <button onClick={() => setCurrentView('dashboard')} style={{ padding: '8px 16px', fontSize: '1.2rem', backgroundColor: '#34495E', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                 📊 Parent Dashboard
               </button>
            )}
          </div>
        </header>
      )}

      <main className="app-main">
        <div className="main-container">
          {currentView === 'dashboard' && (
            <ParentDashboardWrapper onBack={() => setCurrentView('catalog')} />
          )}
          {/* --- VIEW 1: ACTIVITY CATALOG --- */}
          {currentView === 'catalog' && (
            <ActivityCatalog onSelectActivity={handleSelectActivity} />
          )}

          {/* --- VIEW 2: INSTRUCTIONS --- */}
          {currentView === 'instructions' && (
            <InstructionsScreen 
              activityId={selectedActivity}
              onStartPractice={handleStartPractice}
              onBack={handleBackToMenu}
            />
          )}

          {/* --- VIEW 3: GAME SCREEN --- */}
          {currentView === 'game' && (
            <>
              <StatusBar isConnected={connectionStatus === 'connected'} socketId="Mediasoup Server" statusMessage={connectionStatus === 'connected' ? 'Active' : connectionStatus} />
              
              <div className="videos-section" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <div className="video-card" style={{ position: 'relative', width: '640px', maxWidth: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
                  
                  {/* HUD */}
                  {poseData && poseData.stats && (
                     <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '15px 0', zIndex: 20, display: 'flex', justifyContent: 'center', gap: '40px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                               {selectedActivity === 'squat' && <div style={{ color: '#FFD700' }}>🦵 Squats: {localScore} / 5</div>}  {/* 🟢 Back to 5 */}
                               {selectedActivity === 'frog_jumps' && <div style={{ color: '#FF6B6B' }}>🐸 Jumps: {localScore} / 5</div>}
                               {selectedActivity === 'crawls' && <div style={{ color: '#4ECDC4' }}>🐻 Crawls: {poseData.stats?.crawls || 0} / 4</div>}
                               {selectedActivity === 'hands_up' && <div style={{ color: '#A29BFE' }}>🙌 Hold: {Math.floor(handsRaisedTime)}s / 10s</div>}
                               {selectedActivity === 'flamingo' && <div style={{ color: '#FF9FF3' }}>🦩 Flamingo: {Math.floor(flamingoTime)}s / 10s</div>}
                             </div>
                  )}

                  <h3 style={{ position: 'absolute', top: 50, left: 15, zIndex: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '4px' }}>Live AI Overlay ({selectedActivity})</h3>

                  {localStream ? (
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto', transform: 'scaleX(-1)' }} />
                  ) : (
                    <div className="placeholder" style={{height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'}}>Press Start to Play</div>
                  )}

                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none', transform: 'scaleX(-1)' }}>
                    {connectionStatus === 'connected' && (
                      <>
                        <PoseCanvas poseData={poseData} ghostPose={null} />
                        {/* VICTORY & ACTION TEXT LOGIC */}
                        {(() => {
                            let isVictory = false;
                            let victoryText = "Mission Complete!";

                            if (selectedActivity === 'squat' && localScore >= 5) {
                                isVictory = true;
                                victoryText = "5 Squats Completed!";
                            } else if (selectedActivity === 'frog_jumps' && localScore >= 5) {
                                isVictory = true;
                                victoryText = "5 Jumps Completed!";
                            } else if (selectedActivity === 'crawls' && poseData?.stats?.crawls >= 4) {
                                isVictory = true;
                                victoryText = "4 Crawls Completed!";
                            } else if (selectedActivity === 'hands_up' && handsRaisedTime >= 10) {
                                isVictory = true;
                                victoryText = "10 Second Hold Complete!";
                            } else if (selectedActivity === 'flamingo' && flamingoTime >= 10) { // 🟢 ADD THIS BLOCK
                                isVictory = true;
                                victoryText = "10 Second Flamingo Complete!";
                            }

                            return (
                              <>
                                {/* VICTORY SCREEN OR GAME TEXT */}
                                {isVictory ? (
                                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) scaleX(-1)', zIndex: 50, textAlign: 'center', background: 'rgba(0, 0, 0, 0.8)', padding: '30px', borderRadius: '20px', border: '4px solid #FFD700', width: '80%', boxShadow: '0 0 30px #FFD700' }}>
                                     <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🏆</div>
                                     <h2 style={{ color: '#FFD700', fontSize: '2.5rem', margin: 0, textTransform: 'uppercase' }}>WOOHOO!</h2>
                                     <p style={{ color: 'white', fontSize: '1.5rem', margin: '10px 0' }}>{victoryText}</p>
                                     {/* <div style={{ marginTop: '20px', color: '#DDD', fontSize: '1rem', background: 'rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '50px', display: 'inline-block' }}>Click ⬅️ Menu to choose a new mission</div> */}
                                     <button onClick={handleMissionComplete} style={{ marginTop: '20px', fontSize: '1.2rem', backgroundColor: '#2ECC71', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.4)', pointerEvents: 'auto' }}>Save & Return to Menu</button>
                                  </div>
                                ) : (
                                  (() => {
                                     const rawAction = poseData?.action || "";
                                     let isValidAction = false;
                                     
                                     if (selectedActivity === 'squat' && (rawAction.includes("Squat") || rawAction.includes("Stand") || rawAction.includes("Down"))) isValidAction = true;
                                     else if (selectedActivity === 'frog_jumps' && (rawAction.includes("JUMP") || rawAction.includes("Standing") || rawAction.includes("Hands Raised"))) isValidAction = true;
                                     else if (selectedActivity === 'crawls' && (rawAction.includes("Crawl") || rawAction.includes("Standing"))) isValidAction = true;
                                     else if (selectedActivity === 'hands_up' && (rawAction.includes("Hands Raised") || rawAction.includes("Standing"))) isValidAction = true;
                                     else if (selectedActivity === 'flamingo' && (rawAction.includes("One Foot!") || rawAction.includes("Standing"))) isValidAction = true;
                                     else if (!['squat', 'frog_jumps', 'crawls', 'hands_up', 'flamingo'].includes(selectedActivity)) isValidAction = true;

                                     if (isValidAction && rawAction !== "Standing") {
                                       return <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) scaleX(-1)', background: 'rgba(255, 255, 255, 0.9)', padding: '15px 30px', borderRadius: '16px', fontSize: '3rem', fontWeight: '800', color: '#E74C3C', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>{rawAction}</div>;
                                     }
                                     return null;
                                  })()
                                )}
                              </>
                            );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="controls-section">
                 <Controls isStreaming={isStreaming} onStartCamera={handleStartCamera} onStopCamera={handleStopSystem} devices={[]} />
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
export default App;