


// import React, { useRef, useEffect } from 'react';

// const PoseCanvas = ({ poseData }) => {
//   const canvasRef = useRef(null);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     // Safety check: If data is completely missing, do nothing (prevents blank flashing)
//     if (!canvas || !poseData || !poseData.landmarks) return;

//     const ctx = canvas.getContext('2d');
//     const width = canvas.width;
//     const height = canvas.height;

//     // 1. Clear previous frame
//     ctx.clearRect(0, 0, width, height);

//     // 2. Draw Landmarks (Joints)
//     ctx.fillStyle = '#00FF00';
    
//     // Filter out low-visibility points (removes "ghost" points jumping around)
//     const validLandmarks = poseData.landmarks.filter(lm => lm.visibility > 0.5);

//     validLandmarks.forEach(lm => {
//       const x = lm.x * width;
//       const y = lm.y * height;
      
//       ctx.beginPath();
//       ctx.arc(x, y, 4, 0, 2 * Math.PI); // Slightly smaller dots for cleaner look
//       ctx.fill();
//     });

//   }, [poseData]);

//   return (
//     <canvas 
//       ref={canvasRef} 
//       width={640} 
//       height={480}
//       style={{ 
//         width: '100%', 
//         height: '100%', 
//         borderRadius: '12px'
//       }} 
//     />
//   );
// };

// export default PoseCanvas;




import React, { useRef, useEffect } from 'react';
const GHOST_OFFSET_X = 0.20;
const GHOST_SCALE = 0.8;

const PoseCanvas = ({ poseData, ghostPose }) => {
  const canvasRef = useRef(null);

  // Define bone connections for the Ghost only
  const SKELETON_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], // Arms
    [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [24, 26], [25, 27], [26, 28], // Legs
    [27, 29], [28, 30], [29, 31], [30, 32]  // Feet
  ];

  const drawGhostSkeleton = (ctx, landmarks, width, height) => {

    const shiftedLandmarks = landmarks.map(lm => {
        // Pivot point (Center of screen)
        const centerX = 0.7;
        const centerY = 0.7;

        // Apply Scaling relative to center
        const scaledX = (lm.x - centerX) * GHOST_SCALE + centerX;
        const scaledY = (lm.y - centerY) * GHOST_SCALE + centerY;

        // Apply Shift (Offset)
        return {
            ...lm,
            x: scaledX + GHOST_OFFSET_X,
            y: scaledY 
        };
    });
    // Style for Ghost: Gold, Dashed, Semi-transparent
    ctx.strokeStyle = '#FFD700'; // Gold
    ctx.fillStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.7; // See-through
    ctx.setLineDash([5, 5]); // Dashed lines

    // 1. Draw Bones
    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const p1 = shiftedLandmarks[i];
      const p2 = shiftedLandmarks[j];
      // Check visibility
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // 2. Draw Joints
    shiftedLandmarks.forEach(lm => {
      if (lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Reset styles
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  };

  const drawLiveUser = (ctx, landmarks, width, height) => {
    // Style for User: Bright Green Dots ONLY (Original Style)
    ctx.fillStyle = '#00FF00'; // Green

    landmarks.forEach(lm => {
      // Filter out low-visibility points
      if (lm.visibility > 0.5) {
        const x = lm.x * width;
        const y = lm.y * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI); // Dots
        ctx.fill();
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    
    // Fix resolution
    canvas.width = width;
    canvas.height = height;

    // Clear frame
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Ghost FIRST (Background layer)
    if (ghostPose && ghostPose.landmarks) {
      drawGhostSkeleton(ctx, ghostPose.landmarks, width, height);
    }

    // 2. Draw Live User SECOND (Foreground layer)
    if (poseData && poseData.landmarks) {
      drawLiveUser(ctx, poseData.landmarks, width, height);
    }

  }, [poseData, ghostPose]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        pointerEvents: 'none',
        borderRadius: '12px'
      }} 
    />
  );
};

export default PoseCanvas;