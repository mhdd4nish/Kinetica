const mediasoup = require('mediasoup');
const config = require('../config/mediasoup.config');
const FrameExtractor = require('./frameExtractor');        
const FrameProcessor = require('./frameProcessor');        
const EventEmitter = require('events');                    
const os = require('os');
const fs = require('fs');
const path = require('path');

class MediasoupManager extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.nextWorkerIdx = 0;
    this.routers = new Map(); // roomId -> router
    this.transports = new Map(); // transportId -> transport
    this.producers = new Map(); // producerId -> producer
    this.consumers = new Map(); // consumerId -> consumer
    this.peers = new Map(); // peerId -> peer info
    this.frameExtractors = new Map();                      
    this.frameProcessor = new FrameProcessor({             
      enableAnalysis: true,
      enablePoseDetection: true,  // Enable MediaPipe
      enableStorage: false  // Set to true to save frames
    });
    // Initialize MediaPipe on startup
    this.initializeFrameProcessor();
  }

  async initializeFrameProcessor() {
    try {
      await this.frameProcessor.initialize();
      console.log('✅ FrameProcessor ready');
    } catch (error) {
      console.error('❌ Failed to initialize FrameProcessor:', error);
    }
  }
  
  /**
   * Initialize mediasoup workers
   */
  async initialize(numWorkers = os.cpus().length) {
    console.log('🚀 Initializing mediasoup with', numWorkers, 'workers');
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      worker.on('died', () => {
        console.error('❌ mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log('✅ Worker created [pid:%d]', worker.pid);
    }
  }

  /**
   * Get next worker (round-robin)
   */
  getNextWorker() {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  /**
   * Create router for a room
   */
  async createRouter(roomId) {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId);
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });

    this.routers.set(roomId, router);
    console.log('✅ Router created for room:', roomId);
    return router;
  }

  /**
   * Get router for room (create if doesn't exist)
   */
  async getRouter(roomId) {
    return this.routers.get(roomId) || await this.createRouter(roomId);
  }

  /**
   * Create WebRTC transport
   */
  async createWebRtcTransport(roomId, peerId, direction) {
    const router = await this.getRouter(roomId);

    const transport = await router.createWebRtcTransport({
      listenIps: config.webRtcTransport.listenIps,
      enableUdp: config.webRtcTransport.enableUdp,
      enableTcp: config.webRtcTransport.enableTcp,
      preferUdp: config.webRtcTransport.preferUdp,
      initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        console.log('🔌 Transport closed [peerId:%s, direction:%s]', peerId, direction);
        transport.close();
        this.transports.delete(transport.id);
      }
    });

    transport.on('close', () => {
      console.log('🔌 Transport closed [peerId:%s, direction:%s]', peerId, direction);
      this.transports.delete(transport.id);
    });

    this.transports.set(transport.id, { transport, peerId, roomId, direction });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * Connect transport
   */
  async connectTransport(transportId, dtlsParameters) {
    const transportInfo = this.transports.get(transportId);
    
    if (!transportInfo) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    await transportInfo.transport.connect({ dtlsParameters });
    console.log('✅ Transport connected:', transportId);
  }

  /**
   * Create producer (client sending media)
   */
  async createProducer(transportId, rtpParameters, kind) {
    const transportInfo = this.transports.get(transportId);
    
    if (!transportInfo) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = await transportInfo.transport.produce({
      kind,
      rtpParameters,
    });

    producer.on('transportclose', () => {
      console.log('🔌 Producer transport closed [id:%s]', producer.id);
      this.stopFrameExtraction(producer.id);               
      producer.close();
      this.producers.delete(producer.id);
    });

    this.producers.set(producer.id, {
      producer,
      peerId: transportInfo.peerId,
      roomId: transportInfo.roomId,
      kind,
    });

    console.log('✅ Producer created [id:%s, kind:%s, peerId:%s]', 
      producer.id, kind, transportInfo.peerId);

    // Start frame extraction for video producers          
    if (kind === 'video') {               
      console.log('✅ Starting frame extraction');                  
      await this.startFrameExtraction(producer.id);        
    }                                                       

    return { id: producer.id };
  }

  /**
   * Create consumer (client receiving media)
   */
  async createConsumer(transportId, producerId, rtpCapabilities, peerId) {
    const transportInfo = this.transports.get(transportId);
    
    if (!transportInfo) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producerInfo = this.producers.get(producerId);
    
    if (!producerInfo) {
      throw new Error(`Producer not found: ${producerId}`);
    }

    const router = await this.getRouter(transportInfo.roomId);

    // Check if router can consume
    if (!router.canConsume({
      producerId,
      rtpCapabilities,
    })) {
      throw new Error('Cannot consume producer');
    }

    const consumer = await transportInfo.transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused
    });

    consumer.on('transportclose', () => {
      console.log('🔌 Consumer transport closed [id:%s]', consumer.id);
      consumer.close();
      this.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      console.log('🔌 Consumer producer closed [id:%s]', consumer.id);
      consumer.close();
      this.consumers.delete(consumer.id);
    });

    this.consumers.set(consumer.id, {
      consumer,
      peerId,
      roomId: transportInfo.roomId,
    });

    console.log('✅ Consumer created [id:%s, producerId:%s, peerId:%s]', 
      consumer.id, producerId, peerId);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  /**
   * Resume consumer
   */
  async resumeConsumer(consumerId) {
    const consumerInfo = this.consumers.get(consumerId);
    
    if (!consumerInfo) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    await consumerInfo.consumer.resume();
    console.log('▶️  Consumer resumed:', consumerId);
  }

  /**
   * Get router RTP capabilities
   */
  async getRouterRtpCapabilities(roomId) {
    const router = await this.getRouter(roomId);
    return router.rtpCapabilities;
  }

  /**
   * Get producers in room
   */
  getProducersInRoom(roomId, excludePeerId = null) {
    const producers = [];
    
    for (const [producerId, producerInfo] of this.producers.entries()) {
      if (producerInfo.roomId === roomId && producerInfo.peerId !== excludePeerId) {
        producers.push({
          id: producerId,
          peerId: producerInfo.peerId,
          kind: producerInfo.kind,
        });
      }
    }
    
    return producers;
  }

/**
 * Start frame extraction for a producer - FIXED
 */
async startFrameExtraction(producerId) {
  try {
    const producerInfo = this.producers.get(producerId);
    
    if (!producerInfo) {
      throw new Error(`Producer not found: ${producerId}`);
    }

    if (this.frameExtractors.has(producerId)) {
      console.warn('Frame extractor already exists for producer:', producerId);
      return;
    }

    console.log('🎬 Starting frame extraction for producer:', producerId);

    const producer = producerInfo.producer;
    const router = await this.getRouter(producerInfo.roomId);

    // Use a fixed port range for FFmpeg (5000-6000)
    const ffmpegPort = 5000 + Math.floor(Math.random() * 1000);
    const rtcpPort = ffmpegPort + 1;

    console.log(`🎯 Will use FFmpeg port: ${ffmpegPort}, RTCP: ${rtcpPort}`);

    // Create PlainTransport WITHOUT comedia
    const plainTransport = await router.createPlainTransport({
      listenInfo: {
        protocol: 'udp',
        ip: '127.0.0.1',
        announcedIp: null
      },
      rtcpMux: false,
      comedia: false,
      enableSctp: false,
      enableSrtp: false
    });

    console.log('✅ PlainTransport created for frame extraction:', plainTransport.id);

    // Connect transport to FFmpeg's listening port
    await plainTransport.connect({
      ip: '127.0.0.1',
      port: ffmpegPort,
      rtcpPort: rtcpPort
    });

    console.log(`✅ PlainTransport connected to FFmpeg endpoint ${ffmpegPort}/${rtcpPort}`);

    // Create frame extractor with REDUCED FPS
    const extractor = new FrameExtractor(producerId, {
      fps: 24,  // REDUCED to 2 FPS for slower processing
      width: 640,
      height: 480,
      format: 'rgb24',
      enableLogging: false,  // Disable verbose logging
      rtpHost: '127.0.0.1',
      rtpPort: ffmpegPort
    });

    // Store manager reference for proper context
    const manager = this;
    let isProcessing = false;

    // Listen to frame events with proper context
    extractor.on('frame', async (frame) => {
      // Skip if already processing to avoid backlog
      if (isProcessing) {
        return;
      }
      
      isProcessing = true;
      
      try {
        console.log('📸 Frame received in manager, size:', frame.data.length);

        // Save raw frame to disk (optional)
        // const framesDir = path.join(__dirname, '../frames', producerId);
        // if (!fs.existsSync(framesDir)) {
        //   fs.mkdirSync(framesDir, { recursive: true });
        // }
        
        // // Convert to JPEG and save
        // const sharp = require('sharp');
        // const jpegPath = path.join(framesDir, `frame_${frame.sequenceNumber}.jpg`);
        
        // await sharp(frame.data, {
        //   raw: {
        //     width: frame.width,
        //     height: frame.height,
        //     channels: 3
        //   }
        // })
        // .jpeg({ quality: 80 })
        // .toFile(jpegPath);
        
        // console.log('💾 Saved frame to:', jpegPath);
        
        // Process the frame
        const result = await manager.frameProcessor.process(
          frame.data,
          frame.width,
          frame.height,
          frame.format
        );
        
        console.log('✅ Frame processed successfully');
        
        // Emit frame event for external listeners
        manager.emit('frameExtracted', {
          producerId,
          frameId: frame.id,
          timestamp: frame.timestamp,
          width: frame.width,
          height: frame.height,
          analysis: result.analysis
        });
      } catch (error) {
        console.error('❌ Error processing frame:', error);
      } finally {
        isProcessing = false;
      }
    });

    extractor.on('error', (error) => {
      console.error('❌ Frame extractor error:', error);
    });

    extractor.on('end', () => {
      console.log('⏹️ Frame extractor ended for producer:', producerId);
      manager.frameExtractors.delete(producerId);
      
      // Cleanup
      if (consumer && !consumer.closed) {
        consumer.close();
      }
      if (plainTransport && !plainTransport.closed) {
        plainTransport.close();
      }
    });

    // Start extraction
    console.log('🚀 Starting extractor...');
    extractor.start();

  ///////////////////
// Wait for FFmpeg to be ready
await new Promise(resolve => setTimeout(resolve, 1000));

// NOW create consumer - FFmpeg is already listening
const consumer = await plainTransport.consume({
  producerId: producer.id,
  rtpCapabilities: router.rtpCapabilities,
  paused: false
});

console.log('✅ Consumer created on PlainTransport:', consumer.id);

// Request keyframe
await consumer.requestKeyFrame();
console.log('🔑 Requested keyframe');
  ///////////////////

    // Store extractor with transport and consumer for cleanup
    this.frameExtractors.set(producerId, {
      extractor,
      plainTransport,
      consumer
    });

    console.log('✅ Frame extraction started for producer:', producerId);
  } catch (error) {
    console.error('❌ Error starting frame extraction:', error);
    throw error;
  }
}

  /**
   * Stop frame extraction for a producer - UPDATED
   */
  stopFrameExtraction(producerId) {
    const extractorInfo = this.frameExtractors.get(producerId);
    
    if (extractorInfo) {
      console.log('⏹️  Stopping frame extraction for producer:', producerId);
      
      const { extractor, plainTransport, consumer } = extractorInfo;
      
      // Stop extractor
      extractor.stop();
      
      // Close consumer and transport
      if (consumer && !consumer.closed) {
        consumer.close();
      }
      
      if (plainTransport && !plainTransport.closed) {
        plainTransport.close();
      }
      
      this.frameExtractors.delete(producerId);
    }
  }

  /**
   * Get latest frame for a producer - UPDATED
   */
  getLatestFrame(producerId) {
    const extractorInfo = this.frameExtractors.get(producerId);
    return extractorInfo ? extractorInfo.extractor.getLatestFrame() : null;
  }

  /**
   * Get frame extraction stats for a producer - UPDATED
   */
  getFrameExtractionStats(producerId) {
    const extractorInfo = this.frameExtractors.get(producerId);
    return extractorInfo ? extractorInfo.extractor.getStats() : null;
  }

  /**
   * Get all frame extraction stats - UPDATED
   */
  getAllFrameExtractionStats() {
    const stats = {};
    
    for (const [producerId, extractorInfo] of this.frameExtractors.entries()) {
      stats[producerId] = extractorInfo.extractor.getStats();
    }
    
    return stats;
  }


  /**
   * Close peer (cleanup all resources)
   */
  closePeer(peerId) {
    console.log('🧹 Cleaning up peer:', peerId);

    // Close all producers and stop frame extraction
    for (const [producerId, producerInfo] of this.producers.entries()) {
      if (producerInfo.peerId === peerId) {
        this.stopFrameExtraction(producerId);
        producerInfo.producer.close();
        this.producers.delete(producerId);
      }
    }

    // Close all consumers
    for (const [consumerId, consumerInfo] of this.consumers.entries()) {
      if (consumerInfo.peerId === peerId) {
        consumerInfo.consumer.close();
        this.consumers.delete(consumerId);
      }
    }

    // Close all transports
    for (const [transportId, transportInfo] of this.transports.entries()) {
      if (transportInfo.peerId === peerId) {
        transportInfo.transport.close();
        this.transports.delete(transportId);
      }
    }

    this.peers.delete(peerId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      workers: this.workers.length,
      routers: this.routers.size,
      transports: this.transports.size,
      producers: this.producers.size,
      consumers: this.consumers.size,
      peers: this.peers.size,
      frameExtractors: this.frameExtractors.size,          
      frameProcessing: this.frameProcessor.getStats()      
    };
  }
}

// Export singleton instance
module.exports = new MediasoupManager();