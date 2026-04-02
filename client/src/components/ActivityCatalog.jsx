import React from 'react';
import { ACTIVITIES } from '../data/activities';

const ActivityCatalog = ({ onSelectActivity }) => {
  return (
    <div className="catalog-container" style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ 
        fontSize: '2.5rem', 
        marginBottom: '30px',
        background: 'linear-gradient(45deg, #FFD700, #FF6B6B)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: '900'
      }}>
        CHOOSE YOUR MISSION
      </h1>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {ACTIVITIES.map((activity) => (
          <div 
            key={activity.id}
            onClick={() => !activity.locked && onSelectActivity(activity.id)}
            style={{
              backgroundColor: activity.locked ? '#e0e0e0' : 'white',
              borderRadius: '20px',
              padding: '20px',
              cursor: activity.locked ? 'not-allowed' : 'pointer',
              border: `4px solid ${activity.locked ? '#ccc' : activity.color}`,
              boxShadow: activity.locked ? 'none' : '0 8px 16px rgba(0,0,0,0.1)',
              transform: 'scale(1)',
              transition: 'transform 0.2s',
              opacity: activity.locked ? 0.7 : 1,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!activity.locked) e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (!activity.locked) e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {/* Lock Overlay */}
            {activity.locked && (
              <div style={{
                position: 'absolute', top: 10, right: 10, fontSize: '1.5rem'
              }}>🔒</div>
            )}

            {/* Icon */}
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>
              {activity.icon}
            </div>

            {/* Title */}
            <h2 style={{ margin: '0 0 5px 0', color: '#333' }}>{activity.title}</h2>
            
            {/* Stats Row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', color: '#666', fontSize: '0.9rem' }}>
              <span>⏱️ {activity.duration}</span>
              <span>
                {'⭐'.repeat(activity.difficulty)}
                <span style={{opacity: 0.3}}>{'⭐'.repeat(3 - activity.difficulty)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityCatalog;