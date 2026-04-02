const axios = require('axios');
const { clearLine, cursorTo } = require('readline');

async function monitorFrames() {
  console.clear();
  console.log('📊 Frame Extraction Monitor\n');
  console.log('Press Ctrl+C to stop\n');

  setInterval(async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/stats');
      const stats = response.data;

      console.clear();
      console.log('📊 Frame Extraction Monitor');
      console.log('═'.repeat(70));
      console.log(`Time: ${new Date().toLocaleTimeString()}\n`);

      console.log('🌐 Server Stats:');
      console.log(`   Clients:         ${stats.totalClients}`);
      console.log(`   Producers:       ${stats.mediasoup.producers}`);
      console.log(`   Frame Extractors: ${stats.mediasoup.frameExtractors}\n`);

      if (stats.mediasoup.frameProcessing) {
        console.log('⚙️  Frame Processing Stats:');
        console.log(`   Frames Processed: ${stats.mediasoup.frameProcessing.framesProcessed}`);
        console.log(`   Avg Time:         ${stats.mediasoup.frameProcessing.avgProcessingTime}ms`);
        console.log(`   Errors:           ${stats.mediasoup.frameProcessing.errors}\n`);
      }

      if (stats.frameExtraction && Object.keys(stats.frameExtraction).length > 0) {
        console.log('📹 Active Frame Extractors:');
        console.log('─'.repeat(70));
        
        for (const [producerId, extractorStats] of Object.entries(stats.frameExtraction)) {
          console.log(`\n   Producer: ${producerId.substring(0, 20)}...`);
          console.log(`   ├─ Status:      ${extractorStats.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
          console.log(`   ├─ Frames:      ${extractorStats.framesExtracted}`);
          console.log(`   ├─ Buffer:      ${extractorStats.bufferSize}/${extractorStats.maxBufferSize}`);
          console.log(`   ├─ Avg FPS:     ${extractorStats.avgFps}`);
          console.log(`   ├─ Uptime:      ${extractorStats.uptime}s`);
          console.log(`   ├─ Bytes:       ${(extractorStats.bytesProcessed / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   └─ Errors:      ${extractorStats.errors}`);
          
          if (extractorStats.timeSinceLastFrame !== null) {
            const timeSince = extractorStats.timeSinceLastFrame;
            const status = timeSince > 5000 ? '⚠️  STALE' : '✅ ACTIVE';
            console.log(`      Last Frame:  ${timeSince}ms ago ${status}`);
          }
        }
      } else {
        console.log('\n⚠️  No active frame extractors');
      }

      console.log('\n' + '═'.repeat(70));
      console.log('Press Ctrl+C to stop');

    } catch (error) {
      console.error('Error fetching stats:', error.message);
    }
  }, 2000);
}

monitorFrames();