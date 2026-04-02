
import React, { useEffect, useState, useRef } from 'react';
import { ACTIVITIES } from '../data/activities';

// 🟢 1. DEFINE THE SCRIPTS HERE
const INSTRUCTION_SCRIPTS = {
  squat: {
    intro: "Hey buddy! Here is your mission.🦵",
    steps: [
      "Stand back so we can see your whole body.",
      "Then, bend your knees, till it looks like you're sitting on an invisible chair, and then stand back up!",
      "Try to keep you back straight while doing it. Do this 5 times to win the trophy.",
      "Are you ready? YOU GOT THIS!"
    ]
  },
  frog_jumps: {
    intro: "Get ready to blast off! 🚀",
    steps: [
      "Make sure you have plenty of space and stand back so we can see your whole body.",
      "Bring your hands down and get into a frog pose, just like me!🐸",
      "Then jump as high as you can and come back in the same pose. Do 5 Frog Jumps to win!",
      "Are you ready? YOU GOT THIS!"
    ]
  },
  crawls: {
    intro: "Let's move like animals! 🐻",
    steps: [
      "Make sure you have plenty of space and stand back.",
      "Get down on your hands and knees, facing the right or left.",
      "Finish 4 crawls to WIN!"
    ]
  },
  hands_up: {
    intro: "Let's reach for the STARS! 🌟",
    steps: [
      "Make sure you have plenty of space and stand back so we can see your whole body.",
      "Raise your hands up high, like you are touching the ceiling",
      "Hold your hands there for 10 seconds to WIN!"
    ]
  },
  flamingo: {
    intro: "Time to test your balance! 🦩",
    steps: [
      "Make sure you have plenty of space and stand back, facing the camera.",
      "Lift one foot off the ground like a flamingo.",
      "Keep your balance and hold it for 10 seconds to WIN!",
      "Are you ready? YOU GOT THIS!"
    ]
  },
  // Fallback for any locked/new games
  default: {
    intro: "Here is your mission!",
    steps: [
      "Follow the moves on the screen.",
      "Do your best and have fun!",
      "Complete the goal to win a trophy."
    ]
  }
};

const InstructionsScreen = ({ activityId, onStartPractice, onBack }) => {
  const activity = ACTIVITIES.find(a => a.id === activityId) || ACTIVITIES[0];
  
  // 🟢 2. SELECT THE RIGHT TEXT
  const script = INSTRUCTION_SCRIPTS[activityId] || INSTRUCTION_SCRIPTS['default'];
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audio1Ref = useRef(null);
  const audio2Ref = useRef(null);

  const playVoiceSequence = () => {
    if (audio1Ref.current) { audio1Ref.current.pause(); audio1Ref.current.currentTime = 0; }
    if (audio2Ref.current) { audio2Ref.current.pause(); audio2Ref.current.currentTime = 0; }

    audio1Ref.current = new Audio(`/assets/audio/${activity.id}_1.wav`);
    audio2Ref.current = new Audio(`/assets/audio/${activity.id}_2.wav`);

    setIsPlaying(true);
    
    // wrap play in a try/catch because sometimes browsers block auto-play if files are missing
    audio1Ref.current.play().catch(e => console.log("Audio 1 missing or blocked:", e));

    audio1Ref.current.onended = () => {
      if (audio2Ref.current) audio2Ref.current.play().catch(e => console.log("Audio 2 missing or blocked:", e));
    };

    audio2Ref.current.onended = () => {
      setIsPlaying(false);
    };
  };

  useEffect(() => {
    playVoiceSequence();
    return () => {
      if (audio1Ref.current) audio1Ref.current.pause();
      if (audio2Ref.current) audio2Ref.current.pause();
    };
  }, [activityId]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh', 
      backgroundColor: '#1a1a1a',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '30px',
      textAlign: 'center',
      overflow: 'hidden' 
    }}>
      
      <h1 style={{ 
        color: activity.color, 
        textTransform: 'uppercase', 
        fontSize: '3rem', 
        marginBottom: '10px',
        textShadow: '0 4px 10px rgba(0,0,0,0.5)'
      }}>
        {activity.title}
      </h1>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '30px',
        marginTop: '40px',
        marginBottom: '30px',
        maxWidth: '900px',
        width: '90%'
      }}>
          <img 
            src={activity.characterImage}
            alt="Instructor character"
            // Add a fallback in case the file is missing
            onError={(e) => { e.target.onerror = null; e.target.src='/assets/mickey.png'; }}
            style={{ 
                height: '350px', 
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                animation: 'gentleFloat 3s ease-in-out infinite'
            }} 
          />

          <div style={{ position: 'relative', marginTop: '-30px', flex: 1 }}> 
               <div style={{ 
                   background: 'white', 
                   color: '#333', 
                   padding: '25px', 
                   borderRadius: '30px',
                   boxShadow: `0 10px 30px rgba(255, 255, 255, 0.2), inset 0 0 20px ${activity.color}22`,
                   border: `4px solid ${activity.color}`,
                   fontSize: '1.4rem',
                   lineHeight: '1.6',
                   fontWeight: '600',
                   textAlign: 'left'
               }}>
                  {/* 🟢 3. RENDER THE DYNAMIC TEXT */}
                  <p style={{ marginBottom: '15px', fontSize: '1.5rem', fontWeight: '800', color: activity.color }}>
                    {script.intro}
                  </p>
                  <ol style={{ paddingLeft: '25px', margin: 0 }}>
                    {script.steps.map((step, index) => (
                      <li key={index} style={{ marginBottom: '10px' }}>{step}</li>
                    ))}
                  </ol>
               </div>
               
               <div style={{
                   position: 'absolute',
                   left: '-14px', 
                   top: '50px',   
                   width: '30px',
                   height: '30px',
                   backgroundColor: 'white',
                   borderLeft: `4px solid ${activity.color}`,
                   borderBottom: `4px solid ${activity.color}`,
                   transform: 'rotate(45deg)', 
               }} />
          </div>
      </div>

      <style>
        {`@keyframes gentleFloat { 
            0%, 100% { transform: translateY(0); } 
            50% { transform: translateY(-10px); } 
        }`}
      </style>

      <button 
        onClick={playVoiceSequence}
        style={{
          background: 'none', border: `2px solid ${activity.color}`, color: activity.color,
          padding: '10px 25px', borderRadius: '50px', cursor: 'pointer',
          marginBottom: '30px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px',
          fontWeight: 'bold'
        }}
      >
        {isPlaying ? '🔊 Your Buddy is talking...' : '🔈 Replay Instructions'}
      </button>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <button 
          onClick={onBack}
          style={{
            padding: '15px 30px', fontSize: '1.2rem', borderRadius: '12px',
            background: 'rgba(255,255,255,0.1)', color: 'white', border: '2px solid #fff',
            cursor: 'pointer'
          }}
        >
          ⬅️ Back
        </button>

        <button 
          onClick={onStartPractice}
          style={{
            padding: '15px 50px', fontSize: '1.5rem', borderRadius: '12px',
            background: `linear-gradient(45deg, ${activity.color}, #ffffff)`, 
            color: '#000', border: 'none', fontWeight: 'bold',
            cursor: 'pointer', boxShadow: `0 4px 20px ${activity.color}66`,
            transform: 'scale(1.05)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.05)'}
        >
          Start Mission! 🚀
        </button>
      </div>

    </div>
  );
};

export default InstructionsScreen;