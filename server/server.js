

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const mediasoup = require('mediasoup');
const config = require('./config');

let worker;
let router;

// Track all sessions
const browserSessions = new Map(); // userId -> { transport, producer }
const pythonWorkers = new Map();   // socketId -> { transport, consumers: Map(userId -> consumer) }

// Initialize Mediasoup
async function runMediasoup() {
  worker = await mediasoup.createWorker(config.mediasoup.worker);
  
  worker.on('died', () => {
    console.error('❌ Mediasoup worker died, exiting...');
    setTimeout(() => process.exit(1), 2000);
  });

  router = await worker.createRouter({ 
    mediaCodecs: config.mediasoup.router.mediaCodecs 
  });
  
  console.log('✅ Mediasoup Router Created');
  console.log('   Codecs:', router.rtpCapabilities.codecs.map(c => c.mimeType).join(', '));
}

runMediasoup();

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('identify', ({ type, userId }) => {
    socket.clientType = type;
    socket.userId = userId;
    if (userId) {
      socket.join(userId);
    }
    console.log(`   Type: ${type}, User: ${userId || 'N/A'}`);
  });

  // BROWSER CLIENT (React)
  
  socket.on('getRouterRtpCapabilities', (callback) => {
    callback(router.rtpCapabilities);
  });

  socket.on('createWebRtcTransport', async ({ sender }, callback) => {
    try {
      const transport = await router.createWebRtcTransport(
        config.mediasoup.webRtcTransport
      );
      
      transport.on('dtlsstatechange', (state) => {
        if (state === 'closed') {
          console.log(`🔒 WebRTC transport closed for user ${socket.userId}`);
          transport.close();
        }
      });

      if (!browserSessions.has(socket.userId)) {
        browserSessions.set(socket.userId, {});
      }
      browserSessions.get(socket.userId).transport = transport;

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
      
      console.log(`✅ WebRTC transport created for user ${socket.userId}`);
    } catch (err) {
      console.error('❌ Transport creation error:', err);
      callback({ error: err.message });
    }
  });

  socket.on('connectWebRtcTransport', async ({ dtlsParameters }, callback) => {
    try {
      const session = browserSessions.get(socket.userId);
      if (!session?.transport) {
        return callback?.({ error: 'Transport not found' });
      }
      
      await session.transport.connect({ dtlsParameters });
      console.log(`🔗 WebRTC transport connected for user ${socket.userId}`);
      callback?.({ status: 'connected' });
    } catch (err) {
      console.error('❌ Transport connect error:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters }, callback) => {
    try {
      const session = browserSessions.get(socket.userId);
      if (!session?.transport) {
        return callback({ error: 'Transport not found' });
      }

      const producer = await session.transport.produce({ kind, rtpParameters });
      session.producer = producer;
      
      producer.on('transportclose', () => {
        console.log(`🚪 Producer closed for user ${socket.userId}`);
        producer.close();
      });

      console.log(`🎥 Producer created for user ${socket.userId}: ${producer.id}`);
      
      io.emit('newProducer', { 
        userId: socket.userId,
        producerId: producer.id 
      });

      callback({ id: producer.id });
    } catch (err) {
      console.error('❌ Produce error:', err);
      callback({ error: err.message });
    }
  });

  // PYTHON WORKER (Processing)
  
  socket.on('createPlainTransport', async (data, callback) => {
    try {
      const plainTransport = await router.createPlainTransport({
        listenIp: config.mediasoup.plainTransport.listenIp,
        rtcpMux: false,
        comedia: false, 
      });
      
      plainTransport.on('tuple', (tuple) => {
        console.log(`📡 PlainTransport tuple updated: ${tuple.localIp}:${tuple.localPort}`);
      });

      if (!pythonWorkers.has(socket.id)) {
        pythonWorkers.set(socket.id, {
          consumers: new Map()
        });
      }
      pythonWorkers.get(socket.id).transport = plainTransport;

      console.log(`🐍 PlainTransport created for Python ${socket.id}`);
      console.log(`   RTP:  ${plainTransport.tuple.localIp}:${plainTransport.tuple.localPort}`);
      console.log(`   RTCP: ${plainTransport.rtcpTuple?.localPort || 'N/A'}`);

      callback({
        id: plainTransport.id,
        ip: plainTransport.tuple.localIp,
        port: plainTransport.tuple.localPort,
        rtcpPort: plainTransport.rtcpTuple?.localPort
      });
    } catch (err) {
      console.error('❌ PlainTransport creation error:', err);
      callback({ error: err.message });
    }
  });

  socket.on('connectPlainTransport', async ({ ip, port, rtcpPort }, callback) => {
    try {
      const worker = pythonWorkers.get(socket.id);
      if (!worker?.transport) {
        return callback?.({ error: 'Transport not found' });
      }

      console.log(`🔗 Connecting PlainTransport to Python at ${ip}:${port}`);
      
      await worker.transport.connect({ 
        ip, 
        port, 
        rtcpPort: rtcpPort || undefined 
      });
      
      console.log(`✅ PlainTransport connected! Mediasoup will send RTP to ${ip}:${port}`);
      callback?.({ status: 'connected' });
    } catch (err) {
      console.error('❌ PlainTransport connect error:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('consume', async ({ userId, producerId, rtpCapabilities }, callback) => {
    try {
      const session = browserSessions.get(userId);
      const worker = pythonWorkers.get(socket.id);

      if (!session?.producer) {
        return callback({ error: 'Producer not found' });
      }

      if (!worker?.transport) {
        return callback({ error: 'PlainTransport not found' });
      }

      const cleanCapabilities = {
        codecs: [{
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {}
        }],
        headerExtensions: [] 
      };

      if (!router.canConsume({ 
        producerId: session.producer.id, 
        rtpCapabilities: cleanCapabilities 
      })) {
        return callback({ error: 'Router cannot consume this producer' });
      }

      const consumer = await worker.transport.consume({
        producerId: session.producer.id,
        rtpCapabilities: cleanCapabilities,
        paused: false 
      });

      worker.consumers.set(userId, consumer);

      console.log(`⚡ Consumer created: Python ${socket.id} → User ${userId}`);
      console.log(`   Consumer ID: ${consumer.id}`);

      callback({
        id: consumer.id,
        producerId: session.producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (err) {
      console.error('❌ Consume error:', err);
      callback({ error: err.message });
    }
  });

  // POSE DATA RELAY (Python → Browser)
  
  socket.on('poseData', ({ userId, data }) => {
    // Send to all connected sockets (they'll filter by userId on client side)
    // io.emit('poseData', { userId, data });
    io.to(userId).emit('poseData', { userId, data });
  });

  // CLEANUP
  
  socket.on('disconnect', () => {
    console.log(`👋 Disconnected: ${socket.id}`);

    if (socket.userId && browserSessions.has(socket.userId)) {
      const session = browserSessions.get(socket.userId);
      if (session.producer) {
        session.producer.close();
        console.log(`   Closed producer for user ${socket.userId}`);
      }
      if (session.transport) {
        session.transport.close();
        console.log(`   Closed transport for user ${socket.userId}`);
      }
      browserSessions.delete(socket.userId);
    }

    if (pythonWorkers.has(socket.id)) {
      const worker = pythonWorkers.get(socket.id);
      
      worker.consumers.forEach((consumer, userId) => {
        consumer.close();
        console.log(`   Closed consumer for user ${userId}`);
      });
      
      if (worker.transport) {
        worker.transport.close();
        console.log(`   Closed PlainTransport`);
      }
      
      pythonWorkers.delete(socket.id);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    browserSessions: browserSessions.size,
    pythonWorkers: pythonWorkers.size,
    router: {
      id: router.id,
      codecs: router.rtpCapabilities.codecs.map(c => c.mimeType)
    }
  });
});

server.listen(3000, () => {
  console.log('🚀 Mediasoup Server running on port 3000');
  console.log('📊 Health check: http://localhost:3000/health');
});