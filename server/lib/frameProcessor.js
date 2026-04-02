const EventEmitter = require('events');
const sharp = require('sharp');
const MediapipePoseProcessor = require('./mediapipePoseProcessor');

/**
 * Frame Processor - Processes extracted frames with MediaPipe Pose Detection
 */
class FrameProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableAnalysis: options.enableAnalysis !== false,
      enablePoseDetection: options.enablePoseDetection !== false,
      enableStorage: options.enableStorage || false,
      storageDir: options.storageDir || './frames',
      ...options
    };
    
    this.stats = {
      framesProcessed: 0,
      processingTime: 0,
      errors: 0,
      posesDetected: 0
    };

    // Initialize MediaPipe
    this.mediapipe = null;
    this.initialized = false;
  }

  /**
   * Initialize MediaPipe Pose Processor
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  FrameProcessor already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing MediaPipe Pose Processor...');
      
      if (this.options.enablePoseDetection) {
        this.mediapipe = new MediapipePoseProcessor();
        await this.mediapipe.initialize();
        console.log('✅ MediaPipe Pose Processor initialized');
      }
      
      this.initialized = true;
      console.log('✅ FrameProcessor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize FrameProcessor:', error);
      throw error;
    }
  }

  /**
   * Process a frame with MediaPipe Pose Detection
   */
  async process(frameData, width, height, format) {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        throw new Error('FrameProcessor not initialized. Call initialize() first.');
      }

      console.log('🔍 Processing frame:', { 
        size: frameData.length, 
        width, 
        height, 
        format 
      });
      
      const results = {};

      // Basic frame analysis
      if (this.options.enableAnalysis) {
        results.frameAnalysis = await this.analyzeFrame(frameData, width, height, format);
      }

      // MediaPipe Pose Detection
      if (this.options.enablePoseDetection && this.mediapipe) {
        results.pose = await this.mediapipe.detectPose(frameData, width, height);
        
        if (results.pose.detected) {
          this.stats.posesDetected++;
          console.log('✅ Pose detected - Landmarks:', results.pose.landmarks.length);
        } else {
          console.log('⚠️  No pose detected in frame');
        }
      }

      // Update stats
      const processingTime = Date.now() - startTime;
      this.stats.framesProcessed++;
      this.stats.processingTime += processingTime;

      console.log(`⏱️  Frame processed in ${processingTime}ms`);

      return {
        success: true,
        analysis: results,
        processingTime,
        processedAt: Date.now()
      };
    } catch (error) {
      console.error('❌ Error processing frame:', error);
      this.stats.errors++;
      
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
        processedAt: Date.now()
      };
    }
  }

  /**
   * Analyze frame using Sharp (brightness, sharpness, etc.)
   */
  async analyzeFrame(frameData, width, height, format) {
    try {
      // Convert raw RGB24 data to Sharp-compatible format
      const image = sharp(frameData, {
        raw: {
          width: width,
          height: height,
          channels: 3  // RGB24 = 3 channels
        }
      });
      
      // Get image stats
      const stats = await image.stats();
      const metadata = await image.metadata();
      
      return {
        stats,
        metadata,
        brightness: this.calculateBrightness(stats),
        sharpness: await this.calculateSharpness(image.clone()),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Error analyzing frame:', error);
      throw error;
    }
  }
  
  /**
   * Calculate average brightness from RGB channels
   */
  calculateBrightness(stats) {
    const avg = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
    return Math.round(avg);
  }

  /**
   * Calculate sharpness using Laplacian variance
   */
  async calculateSharpness(image) {
    try {
      // Convert to grayscale and apply Laplacian filter
      const laplacian = await image
        .grayscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
        })
        .stats();

      // Calculate variance (higher = sharper)
      const variance = laplacian.channels[0].stdev ** 2;
      return Math.round(variance);
    } catch (error) {
      console.error('❌ Error calculating sharpness:', error);
      return 0;
    }
  }

  /**
   * Apply transformations to frame
   */
  async applyTransformations(frame) {
    const transformations = [];

    try {
      let image = sharp(frame.data, {
        raw: {
          width: frame.width,
          height: frame.height,
          channels: 3
        }
      });

      // Apply configured transformations
      if (this.options.resize) {
        image = image.resize(this.options.resize.width, this.options.resize.height);
        transformations.push({ type: 'resize', params: this.options.resize });
      }

      if (this.options.blur) {
        image = image.blur(this.options.blur);
        transformations.push({ type: 'blur', params: this.options.blur });
      }

      if (this.options.sharpen) {
        image = image.sharpen();
        transformations.push({ type: 'sharpen' });
      }

      if (this.options.grayscale) {
        image = image.grayscale();
        transformations.push({ type: 'grayscale' });
      }

      // Get transformed buffer
      const transformedData = await image.raw().toBuffer();
      
      return transformations;
    } catch (error) {
      console.error('❌ Error applying transformations:', error);
      return [];
    }
  }

  /**
   * Store frame to disk (optionally with pose overlay)
   */
  async storeFrame(frame, poseData = null) {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Create directory if it doesn't exist
      await fs.mkdir(this.options.storageDir, { recursive: true });

      // Save as JPEG
      const filename = `${frame.producerId}_${frame.sequenceNumber}_${frame.timestamp}.jpg`;
      const filepath = path.join(this.options.storageDir, filename);

      let image = sharp(frame.data, {
        raw: {
          width: frame.width,
          height: frame.height,
          channels: 3
        }
      });

      // If pose data exists, save it as JSON
      if (poseData && poseData.detected) {
        const jsonFilename = `${frame.producerId}_${frame.sequenceNumber}_${frame.timestamp}.json`;
        const jsonFilepath = path.join(this.options.storageDir, jsonFilename);
        await fs.writeFile(jsonFilepath, JSON.stringify(poseData, null, 2));
        console.log('💾 Pose data stored:', jsonFilepath);
      }

      await image
        .jpeg({ quality: 90 })
        .toFile(filepath);

      console.log('💾 Frame stored:', filepath);
      this.emit('stored', { 
        frameId: frame.id, 
        filepath,
        hasPoseData: poseData?.detected || false
      });
      
      return filepath;
    } catch (error) {
      console.error('❌ Error storing frame:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const avgProcessingTime = this.stats.framesProcessed > 0
      ? this.stats.processingTime / this.stats.framesProcessed
      : 0;

    return {
      framesProcessed: this.stats.framesProcessed,
      posesDetected: this.stats.posesDetected,
      poseDetectionRate: this.stats.framesProcessed > 0 
        ? ((this.stats.posesDetected / this.stats.framesProcessed) * 100).toFixed(2) + '%'
        : '0%',
      totalProcessingTime: this.stats.processingTime,
      avgProcessingTime: avgProcessingTime.toFixed(2) + 'ms',
      errors: this.stats.errors
    };
  }

  /**
   * Stop and cleanup MediaPipe processor
   */
  stop() {
    if (this.mediapipe) {
      console.log('⏹️  Stopping MediaPipe Pose Processor...');
      this.mediapipe.stop();
      this.mediapipe = null;
    }
    this.initialized = false;
    console.log('✅ FrameProcessor stopped');
  }
}

module.exports = FrameProcessor;