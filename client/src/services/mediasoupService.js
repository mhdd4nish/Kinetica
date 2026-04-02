import * as mediasoupClient from 'mediasoup-client';

/**
 * mediasoup Service - Manages mediasoup device and transports
 */
class MediasoupService {
  constructor() {
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // track -> producer
    this.consumers = new Map(); // consumerId -> consumer
    this.socket = null;
    this.isLoaded = false;
  }

  /**
   * Set socket connection
   */
  setSocket(socket) {
    this.socket = socket;
  }

  /**
   * Initialize mediasoup device
   */
  async initializeDevice() {
    if (this.isLoaded) {
      console.log('Device already loaded');
      return;
    }

    try {
      console.log('🎬 Initializing mediasoup device...');

      // Create device
      this.device = new mediasoupClient.Device();

      // Get router RTP capabilities from server
      // The server returns { rtpCapabilities }, so destructure it
      const { rtpCapabilities } = await this.request('getRouterRtpCapabilities');

      // DEBUG: Log the codecs
      console.log('📡 Router codecs:', rtpCapabilities.codecs);

      // Load device with router capabilities
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });

      this.isLoaded = true;

      // DEBUG: Check what device can produce
      console.log('✅ Device loaded');
      console.log('   Can produce audio:', this.device.canProduce('audio'));
      console.log('   Can produce video:', this.device.canProduce('video'));

      console.log('✅ mediasoup device loaded');
      console.log('   RTP Capabilities:', this.device.rtpCapabilities);
      
      return this.device;
    } catch (error) {
      console.error('Error initializing device:', error);
      throw error;
    }
  }

  /**
   * Create send transport
   */
  async createSendTransport() {
    try {
      if (!this.isLoaded) {
        throw new Error('Device not loaded. Call initializeDevice() first.');
      }

      console.log('🚗 Creating send transport...');

      // Request transport params from server
      const transportParams = await this.request('createWebRtcTransport', {
        direction: 'send'
      });

      console.log('Transport params received:', transportParams.params.id);

      // Create send transport
      this.sendTransport = this.device.createSendTransport(transportParams.params);

      // Handle 'connect' event
      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('🔗 Connecting send transport...');
          
          await this.request('connectTransport', {
            transportId: this.sendTransport.id,
            dtlsParameters
          });

          console.log('✅ Send transport connected');
          callback();
        } catch (error) {
          console.error('Error connecting send transport:', error);
          errback(error);
        }
      });

      // Handle 'produce' event
      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          console.log(`📹 Producing ${kind}...`);

          const { id } = await this.request('produce', {
            transportId: this.sendTransport.id,
            kind,
            rtpParameters
          });

          console.log(`✅ Producer created: ${id}`);
          callback({ id });
        } catch (error) {
          console.error('Error producing:', error);
          errback(error);
        }
      });

      // Handle 'connectionstatechange' event
      this.sendTransport.on('connectionstatechange', (state) => {
        console.log('Send transport connection state:', state);
        
        if (state === 'failed' || state === 'closed') {
          console.error('Send transport connection failed/closed');
          this.sendTransport = null;
        }
      });

      console.log('✅ Send transport created:', this.sendTransport.id);
      return this.sendTransport;

    } catch (error) {
      console.error('Error creating send transport:', error);
      throw error;
    }
  }

  /**
   * Create receive transport
   */
  async createRecvTransport() {
    try {
      if (!this.isLoaded) {
        throw new Error('Device not loaded. Call initializeDevice() first.');
      }

      console.log('🚗 Creating receive transport...');

      // Request transport params from server
      const transportParams = await this.request('createWebRtcTransport', {
        direction: 'recv'
      });

      console.log('Transport params received:', transportParams.params.id);

      // Create receive transport
      this.recvTransport = this.device.createRecvTransport(transportParams.params);

      // Handle 'connect' event
      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('🔗 Connecting receive transport...');

          await this.request('connectTransport', {
            transportId: this.recvTransport.id,
            dtlsParameters
          });

          console.log('✅ Receive transport connected');
          callback();
        } catch (error) {
          console.error('Error connecting receive transport:', error);
          errback(error);
        }
      });

      // Handle 'connectionstatechange' event
      this.recvTransport.on('connectionstatechange', (state) => {
        console.log('Receive transport connection state:', state);

        if (state === 'failed' || state === 'closed') {
          console.error('Receive transport connection failed/closed');
          this.recvTransport = null;
        }
      });

      console.log('✅ Receive transport created:', this.recvTransport.id);
      return this.recvTransport;

    } catch (error) {
      console.error('Error creating receive transport:', error);
      throw error;
    }
  }

  /**
   * Produce media track
   */
  async produce(track, encodings = null) {
    try {
      if (!this.sendTransport) {
        await this.createSendTransport();
      }

      console.log(`📹 Producing ${track.kind} track...`);

      const producerOptions = {
        track,
        ...(encodings && { encodings })
      };
      
      // Add appropriate codec options based on track type
      if (track.kind === 'video') {
        producerOptions.codecOptions = {
          videoGoogleStartBitrate: 1000
        };
      } else if (track.kind === 'audio') {
        // Add audio-specific options if needed
        producerOptions.codecOptions = {
          opusStereo: true,
          opusDtx: true
        };
      }

      const producer = await this.sendTransport.produce(producerOptions);

      // Store producer
      this.producers.set(track.id, producer);

      // Handle transport close
      producer.on('transportclose', () => {
        console.log('Producer transport closed:', producer.id);
        this.producers.delete(track.id);
      });

      // Handle track ended
      producer.on('trackended', () => {
        console.log('Producer track ended:', producer.id);
        this.closeProducer(track.id);
      });

      console.log(`✅ Producer created: ${producer.id} (${track.kind})`);
      return producer;

    } catch (error) {
      console.error('Error producing track:', error);
      throw error;
    }
  }

  /**
   * Consume media from server
   */
  async consume(producerId) {
    try {
      if (!this.recvTransport) {
        await this.createRecvTransport();
      }

      console.log(`📺 Consuming producer: ${producerId}...`);

      // Request to consume
      const consumerParams = await this.request('consume', {
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });

      console.log('Consumer params received:', consumerParams.params.id);

      // Create consumer
      const consumer = await this.recvTransport.consume(consumerParams.params);

      // Store consumer
      this.consumers.set(consumer.id, consumer);

      // Handle transport close
      consumer.on('transportclose', () => {
        console.log('Consumer transport closed:', consumer.id);
        this.consumers.delete(consumer.id);
      });

      // Handle producer close
      consumer.on('producerclose', () => {
        console.log('Consumer producer closed:', consumer.id);
        this.closeConsumer(consumer.id);
      });

      // Resume consumer
      await this.request('resumeConsumer', {
        consumerId: consumer.id
      });

      console.log(`✅ Consumer created: ${consumer.id} (${consumer.kind})`);
      console.log('   Track:', consumer.track);

      return consumer;

    } catch (error) {
      console.error('Error consuming:', error);
      throw error;
    }
  }

  /**
   * Close producer
   */
  closeProducer(trackId) {
    const producer = this.producers.get(trackId);
    
    if (producer) {
      producer.close();
      this.producers.delete(trackId);
      console.log('Producer closed:', producer.id);
    }
  }

  /**
   * Close consumer
   */
  closeConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);

    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
      console.log('Consumer closed:', consumerId);
    }
  }

  /**
   * Close all producers
   */
  closeAllProducers() {
    this.producers.forEach((producer, trackId) => {
      producer.close();
    });
    this.producers.clear();
    console.log('All producers closed');
  }

  /**
   * Close all consumers
   */
  closeAllConsumers() {
    this.consumers.forEach((consumer, consumerId) => {
      consumer.close();
    });
    this.consumers.clear();
    console.log('All consumers closed');
  }

  /**
   * Close all transports
   */
  closeTransports() {
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
      console.log('Send transport closed');
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
      console.log('Receive transport closed');
    }
  }

  /**
   * Close everything
   */
  close() {
    this.closeAllProducers();
    this.closeAllConsumers();
    this.closeTransports();
    this.device = null;
    this.isLoaded = false;
    console.log('mediasoup service closed');
  }

  /**
   * Get device info
   */
  getDeviceInfo() {
    if (!this.device) {
      return null;
    }

    return {
      loaded: this.isLoaded,
      canProduce: {
        audio: this.device.canProduce('audio'),
        video: this.device.canProduce('video')
      },
      rtpCapabilities: this.device.rtpCapabilities
    };
  }

  /**
   * Get statistics
   */
  async getStats() {
    const stats = {
      producers: {},
      consumers: {}
    };

    // Get producer stats
    for (const [trackId, producer] of this.producers.entries()) {
      const producerStats = await producer.getStats();
      stats.producers[producer.id] = {
        kind: producer.kind,
        paused: producer.paused,
        stats: Array.from(producerStats.values())
      };
    }

    // Get consumer stats
    for (const [consumerId, consumer] of this.consumers.entries()) {
      const consumerStats = await consumer.getStats();
      stats.consumers[consumerId] = {
        kind: consumer.kind,
        paused: consumer.paused,
        stats: Array.from(consumerStats.values())
      };
    }

    return stats;
  }

  /**
   * Helper to make async socket requests
   */
  request(event, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
}

export default new MediasoupService();