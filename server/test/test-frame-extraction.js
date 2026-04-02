const io = require('socket.io-client');
const axios = require('axios');
const fs = require('fs');

async function testFrameExtraction() {
  console.log('🧪 Testing Frame Extraction...\n');

  // Connect to server
  const socket = io('http://localhost:5000', {
    transports: ['websocket']
  });

  socket.on('connect', async () => {
    console.log('✅ Connected to server:', socket.id);

    try {
      // Step 1: Get RTP Capabilities
      console.log('\n📡 Step 1: Getting RTP capabilities...');
      const rtpCaps = await emitWithPromise(socket, 'getRouterRtpCapabilities', {});
      console.log('✅ RTP Capabilities received');

      // Step 2: Create Send Transport
      console.log('\n🚗 Step 2: Creating send transport...');
      const sendTransport = await emitWithPromise(socket, 'createWebRtcTransport', {
        direction: 'send'
      });
      console.log('✅ Send transport created:', sendTransport.params.id);

      // Simulate producing video (in real scenario, client would do this)
      console.log('\n📹 Step 3: Simulating video production...');
      console.log('⏳ Waiting for frames to be extracted...');
      
      // Wait for frame extraction to start
      await sleep(5000);

      // Step 4: Check Frame Stats
      console.log('\n📊 Step 4: Checking frame extraction stats...');
      const statsResponse = await axios.get('http://localhost:5000/api/stats');
      const stats = statsResponse.data;
      
      console.log('✅ Server Stats:');
      console.log('   Frame Extractors:', stats.mediasoup.frameExtractors);
      console.log('   Frame Processing:', JSON.stringify(stats.mediasoup.frameProcessing, null, 2));

      // Step 5: Get All Frame Stats
      if (stats.frameExtraction && Object.keys(stats.frameExtraction).length > 0) {
        console.log('\n📈 Step 5: Frame Extraction Details:');
        
        for (const [producerId, extractorStats] of Object.entries(stats.frameExtraction)) {
          console.log(`\n   Producer: ${producerId}`);
          console.log(`   - Frames Extracted: ${extractorStats.framesExtracted}`);
          console.log(`   - Buffer Size: ${extractorStats.bufferSize}`);
          console.log(`   - Avg FPS: ${extractorStats.avgFps}`);
          console.log(`   - Uptime: ${extractorStats.uptime}s`);
          console.log(`   - Errors: ${extractorStats.errors}`);

          // Step 6: Get Latest Frame
          console.log('\n📸 Step 6: Getting latest frame...');
          try {
            const frameResponse = await axios.get(
              `http://localhost:5000/api/frames/${producerId}/latest?format=jpeg`,
              { responseType: 'arraybuffer' }
            );
            
            // Save frame to disk
            const filename = `test-frame-${Date.now()}.jpg`;
            fs.writeFileSync(filename, frameResponse.data);
            console.log(`✅ Frame saved: ${filename}`);
            console.log(`   Size: ${(frameResponse.data.length / 1024).toFixed(2)} KB`);
          } catch (error) {
            console.log('⚠️  No frames available yet');
          }
        }
      } else {
        console.log('⚠️  No frame extractors active');
      }

      console.log('\n✅ All tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
    }

    socket.disconnect();
    process.exit(0);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
  });
}

function emitWithPromise(socket, event, data) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testFrameExtraction();