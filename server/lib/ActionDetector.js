// lib/ActionDetector.js

class ActionDetector {
  constructor() {
    // State variables (Mirrors your Python __init__)
    this.prevHipY = null;
    this.jumpCooldown = 0;
    this.prevHandState = null;
    this.lastCrawlTimestamp = 0;
    this.crawlsDone = 0;
    this.squatsDone = 0;
    this.isTaskComplete = false;
    
    // Constants
    this.TARGET_CRAWLS = 2;
    this.TARGET_SQUATS = 1;
  }

  // Calculate angle between three points (a -> b -> c)
  calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  // Calculate inclination of a line segment relative to vertical
  calculateInclination(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const theta = Math.atan2(dy, dx);
    const angleDeg = Math.abs(theta * 180.0 / Math.PI);
    return Math.abs(90 - angleDeg);
  }

  detect(landmarks) {
    // 1. Stability Check
    const lHip = landmarks[23];
    const rHip = landmarks[24];
    const lShoulder = landmarks[11];
    const rShoulder = landmarks[12];

    // Visibility check (defaulting to 0 if visibility prop is missing)
    const lHipVis = lHip.visibility ?? 1;
    const rHipVis = rHip.visibility ?? 1;

    if (lHipVis < 0.6 || rHipVis < 0.6) {
      return { action: "Body Not Visible", stats: this.getStats() };
    }

    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    if (shoulderWidth > 0.80) {
      return { action: "Too Close!", stats: this.getStats() };
    }

    // 2. Map Landmarks
    const nose = landmarks[0];
    const lWrist = landmarks[15]; const rWrist = landmarks[16];
    const lKnee = landmarks[25]; const rKnee = landmarks[26];
    const lAnkle = landmarks[27]; const rAnkle = landmarks[28];

    // 3. Calculate Angles & Inclinations
    const angleLKnee = this.calculateAngle(lHip, lKnee, lAnkle);
    const angleRKnee = this.calculateAngle(rHip, rKnee, rAnkle);

    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const spineInclination = this.calculateInclination(midShoulder, midHip);

    // 4. Pose Classification Logic
    const handsBelowShoulders = (lWrist.y > lShoulder.y) && (rWrist.y > rShoulder.y);
    const kneesBelowHips = (lKnee.y > lHip.y) && (rKnee.y > rHip.y);
    const isCrawlingPose = (spineInclination > 40) && handsBelowShoulders && kneesBelowHips;
    
    const lAnkleVis = lAnkle.visibility ?? 1;
    const rAnkleVis = rAnkle.visibility ?? 1;
    const legsVisible = lAnkleVis > 0.5 && rAnkleVis > 0.5;

    let detectedAction = "Standing";
    const currentTime = Date.now() / 1000; // JS uses ms, Python uses seconds

    // --- LOGIC PORT START ---
    
    if (isCrawlingPose) {
      this.lastCrawlTimestamp = currentTime;
      const diffY = lWrist.y - rWrist.y;
      const diffX = lWrist.x - rWrist.x;
      let currentHandState = null;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0.05) currentHandState = "Left/Right Cross";
        else if (diffX < -0.05) currentHandState = "Right/Left Cross";
      } else {
        if (diffY > 0.05) currentHandState = "Left Back";
        else if (diffY < -0.05) currentHandState = "Right Back";
      }

      if (currentHandState && this.prevHandState && currentHandState !== this.prevHandState) {
        if (this.crawlsDone < this.TARGET_CRAWLS) {
          this.crawlsDone++;
        }
      }
      if (currentHandState) this.prevHandState = currentHandState;
      detectedAction = `Crawling 🐾 (${this.crawlsDone}/${this.TARGET_CRAWLS})`;

    } else if (legsVisible && spineInclination < 35) {
      if (currentTime - this.lastCrawlTimestamp < 2.0) {
        detectedAction = "Rising...";
      } else {
        let isSquatting = false;
        if (angleLKnee < 130 && angleRKnee < 130) {
          isSquatting = true;
          detectedAction = "Squatting 📉";
          if (angleLKnee < 90 && angleRKnee < 90) {
            detectedAction = "Deep Squat 🏋️";
          }
        }
        if (isSquatting) {
          if (this.crawlsDone >= this.TARGET_CRAWLS) {
            if (this.squatsDone < this.TARGET_SQUATS) {
              this.squatsDone++;
              detectedAction = `Squat Good! ✅ (${this.squatsDone}/${this.TARGET_SQUATS})`;
            }
          }
        }
      }
    }

    // Jump Detection
    if (!isCrawlingPose && detectedAction === "Standing") {
      const currHipY = midHip.y;
      if (this.prevHipY !== null) {
        const velocity = this.prevHipY - currHipY; // Positive means moving UP
        // Check timing buffer
        if (currentTime - this.lastCrawlTimestamp > 3.0) {
           if (velocity > 0.04 && this.jumpCooldown === 0) {
             this.jumpCooldown = 15; // 15 frames cooldown
             detectedAction = "JUMP! 🚀";
           } else if (this.jumpCooldown > 0) {
             this.jumpCooldown--;
             detectedAction = "JUMP! 🚀";
           }
        }
      }
      this.prevHipY = currHipY;
    }

    // Hands Raised & One Foot
    if (detectedAction === "Standing" || detectedAction === "JUMP! 🚀") {
      if (lWrist.y < nose.y && rWrist.y < nose.y) {
        detectedAction = "Hands Raised! 🙌";
      } else if (legsVisible && Math.abs(lAnkle.y - rAnkle.y) > 0.1) {
        detectedAction = "One Foot! ⚖️";
      }
    }

    // Task Completion
    if (this.crawlsDone >= this.TARGET_CRAWLS && this.squatsDone >= this.TARGET_SQUATS) {
      this.isTaskComplete = true;
    }
    if (this.isTaskComplete && detectedAction === "Standing") {
      detectedAction = "Task Complete! 🎉";
    }

    return {
      action: detectedAction,
      stats: this.getStats()
    };
  }

  getStats() {
    return {
      crawls: this.crawlsDone,
      squats: this.squatsDone,
      targetCrawls: this.TARGET_CRAWLS,
      targetSquats: this.TARGET_SQUATS,
      isComplete: this.isTaskComplete
    };
  }
}

module.exports = ActionDetector;