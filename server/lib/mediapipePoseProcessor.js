const { spawn } = require('child_process');
const path = require('path');

class MediaPipePoseProcessor {
  constructor() {
    this.pythonProcess = null;
    this.isReady = false;
    this.pendingCallbacks = new Map();
    this.callbackId = 0;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mediapipe_pose.py');
      
      this.pythonProcess = spawn('/opt/homebrew/bin/python3.11', [pythonScript]);

      let buffer = '';

      this.pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        
        // Process complete JSON messages
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        lines.forEach(line => {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              
              if (response.type === 'ready') {
                this.isReady = true;
                console.log('✅ MediaPipe pose processor ready');
                resolve();
              } else if (response.type === 'result') {
                const callback = this.pendingCallbacks.get(response.id);
                if (callback) {
                  callback(null, response.data);
                  this.pendingCallbacks.delete(response.id);
                }
              } else if (response.type === 'error') {
                const callback = this.pendingCallbacks.get(response.id);
                if (callback) {
                  callback(new Error(response.error), null);
                  this.pendingCallbacks.delete(response.id);
                }
              }
            } catch (err) {
              console.error('Error parsing Python response:', err);
            }
          }
        });
      });

      this.pythonProcess.stderr.on('data', (data) => {
        console.error('MediaPipe Python error:', data.toString());
      });

      this.pythonProcess.on('close', (code) => {
        console.log('MediaPipe Python process exited with code:', code);
        this.isReady = false;
      });

      this.pythonProcess.on('error', (err) => {
        console.error('Failed to start MediaPipe Python process:', err);
        reject(err);
      });

      // Timeout if not ready in 10 seconds
      setTimeout(() => {
        if (!this.isReady) {
          reject(new Error('MediaPipe initialization timeout'));
        }
      }, 10000);
    });
  }

  async detectPose(frameBuffer, width, height) {
    if (!this.isReady) {
      throw new Error('MediaPipe processor not ready');
    }

    return new Promise((resolve, reject) => {
      const id = this.callbackId++;
      
      this.pendingCallbacks.set(id, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });

      // Send frame data to Python process
      const message = {
        id,
        width,
        height,
        frame: frameBuffer.toString('base64')
      };

      this.pythonProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  stop() {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
      this.isReady = false;
    }
  }
}

module.exports = MediaPipePoseProcessor;