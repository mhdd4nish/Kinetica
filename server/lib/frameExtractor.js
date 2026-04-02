const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { PassThrough } = require('stream');
const sharp = require('sharp');
const EventEmitter = require('events');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Frame Extractor - Decodes RTP packets into individual frames
 */
class FrameExtractor extends EventEmitter {
  constructor(producerId, options = {}) {
    super();
    
    this.producerId = producerId;
    this.options = {
      fps: options.fps || 15,              // Extract 15 frames per second
      width: options.width || 640,
      height: options.height || 480,
      format: options.format || 'rgb24',   // Output format
      enableLogging: options.enableLogging || false,
      ...options
    };
    
    this.isRunning = false;
    this.frameCount = 0;
    this.ffmpegProcess = null;
    this.outputStream = null;
    this.frameBuffer = [];
    this.maxBufferSize = options.maxBufferSize || 100;
    
    // Statistics
    this.stats = {
      framesExtracted: 0,
      bytesProcessed: 0,
      errors: 0,
      startTime: null,
      lastFrameTime: null
    };
  }

  start() {
    if (this.isRunning) {
      console.warn('Frame extractor already running for producer:', this.producerId);
      return;
    }
  
    console.log('🎬 Starting frame extractor for producer:', this.producerId);
    
    this.isRunning = true;
    this.stats.startTime = Date.now();
    
    const frameSize = this.options.width * this.options.height * 3;
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    // Create SDP file with proper format
    const sdpContent = [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=mediasoup',
      'c=IN IP4 127.0.0.1',
      't=0 0',
      `m=video ${this.options.rtpPort} RTP/AVP 101`,
      'a=rtpmap:101 VP8/90000',
      'a=fmtp:101',
      'a=rtcp-fb:101 nack',           // Add NACK feedback
      'a=rtcp-fb:101 nack pli',       // Add PLI for keyframe requests
      ''
    ].join('\n');
    
    const sdpPath = path.join(__dirname, `stream_${this.producerId}.sdp`);
    fs.writeFileSync(sdpPath, sdpContent);
    this.sdpPath = sdpPath;
    
    console.log('📝 Created SDP file:', sdpPath);
    console.log('SDP content:\n', sdpContent);
    
    const ffmpegArgs = [
      '-protocol_whitelist', 'file,udp,rtp',
      '-reorder_queue_size', '1000',        // Larger reorder buffer
      '-max_delay', '500000',               // 500ms max delay (in microseconds)
      '-i', sdpPath,
      '-f', 'rawvideo',
      '-pix_fmt', this.options.format,
      '-s', `${this.options.width}x${this.options.height}`,
      '-r', this.options.fps.toString(),
      '-loglevel', 'debug',  // More detailed logs
      // '-vsync', 'drop',                     // Drop frames instead of duplicating
      'pipe:1'
    ];
  
    console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
  
    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  
    let buffer = Buffer.alloc(0);
  
    this.ffmpegProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      while (buffer.length >= frameSize) {
        const frameData = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);
        
        console.log('📸 Frame extracted:', frameData.length, 'bytes');
        this.processFrame(frameData);
      }
    });
  
    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      console.log('FFmpeg:', message);
    });
  
    this.ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      this.emit('error', err);
    });
  
    this.ffmpegProcess.on('close', (code) => {
      console.log('FFmpeg closed with code:', code);
      this.cleanup();
      this.isRunning = false;
      this.emit('end');
    });
  
    console.log('✅ FFmpeg started, waiting for RTP on port:', this.options.rtpPort);
  }
  
  stop() {
    if (this.ffmpegProcess) {
      console.log('⏹️ Stopping FFmpeg process for producer:', this.producerId);
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    this.cleanup();
    this.isRunning = false;
  }
  
  cleanup() {
    if (this.sdpPath) {
      const fs = require('fs');
      try {
        fs.unlinkSync(this.sdpPath);
        console.log('🗑️ Removed SDP file:', this.sdpPath);
      } catch (err) {
        // Ignore cleanup errors
      }
      this.sdpPath = null;
    }
  }

  /**
   * Process extracted frame
   */
  async processFrame(frameData) {
    try {
      this.frameCount++;
      this.stats.framesExtracted++;
      this.stats.lastFrameTime = Date.now();
      this.stats.bytesProcessed += frameData.length;

      const frame = {
        id: `${this.producerId}-${this.frameCount}`,
        producerId: this.producerId,
        timestamp: Date.now(),
        sequenceNumber: this.frameCount,
        data: frameData,
        width: this.options.width,
        height: this.options.height,
        format: this.options.format
      };

      // Add to buffer
      this.addToBuffer(frame);

      // Emit frame event
      this.emit('frame', frame);

      if (this.options.enableLogging && this.frameCount % 30 === 0) {
        console.log(`📸 Extracted ${this.frameCount} frames from producer: ${this.producerId}`);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      this.stats.errors++;
      this.emit('error', error);
    }
  }

  /**
   * Add frame to buffer
   */
  addToBuffer(frame) {
    this.frameBuffer.push(frame);
    
    // Remove oldest frames if buffer is full
    if (this.frameBuffer.length > this.maxBufferSize) {
      const removed = this.frameBuffer.shift();
      if (this.options.enableLogging) {
        console.log('⚠️  Frame buffer full, removed oldest frame:', removed.id);
      }
    }
  }

  /**
   * Get latest frame
   */
  getLatestFrame() {
    return this.frameBuffer[this.frameBuffer.length - 1] || null;
  }

  /**
   * Get frame by sequence number
   */
  getFrameBySequence(sequenceNumber) {
    return this.frameBuffer.find(f => f.sequenceNumber === sequenceNumber) || null;
  }

  /**
   * Get all frames in buffer
   */
  getAllFrames() {
    return [...this.frameBuffer];
  }

  /**
   * Clear frame buffer
   */
  clearBuffer() {
    this.frameBuffer = [];
    console.log('🗑️  Frame buffer cleared for producer:', this.producerId);
  }


  /**
   * Convert frame to JPEG
   */
  async frameToJpeg(frame, quality = 85) {
    try {
      const jpeg = await sharp(frame.data, {
        raw: {
          width: frame.width,
          height: frame.height,
          channels: 3
        }
      })
      .jpeg({ quality })
      .toBuffer();

      return jpeg;
    } catch (error) {
      console.error('Error converting frame to JPEG:', error);
      throw error;
    }
  }

  /**
   * Convert frame to PNG
   */
  async frameToPng(frame) {
    try {
      const png = await sharp(frame.data, {
        raw: {
          width: frame.width,
          height: frame.height,
          channels: 3
        }
      })
      .png()
      .toBuffer();

      return png;
    } catch (error) {
      console.error('Error converting frame to PNG:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    const uptime = this.stats.startTime ? (now - this.stats.startTime) / 1000 : 0;
    const avgFps = uptime > 0 ? this.stats.framesExtracted / uptime : 0;

    return {
      producerId: this.producerId,
      isRunning: this.isRunning,
      framesExtracted: this.stats.framesExtracted,
      bytesProcessed: this.stats.bytesProcessed,
      errors: this.stats.errors,
      bufferSize: this.frameBuffer.length,
      maxBufferSize: this.maxBufferSize,
      uptime: Math.floor(uptime),
      avgFps: avgFps.toFixed(2),
      lastFrameTime: this.stats.lastFrameTime,
      timeSinceLastFrame: this.stats.lastFrameTime ? now - this.stats.lastFrameTime : null
    };
  }

}

module.exports = FrameExtractor;