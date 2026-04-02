import { useState, useCallback, useRef, useEffect } from 'react';

export const useMediaStream = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const streamRef = useRef(null);

  // Get available media devices
  const getDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }, []);

  // Start media stream
  const startStream = useCallback(async (constraints = {}) => {
    try {
      setError(null);
      
      const defaultConstraints = {
        video: {
          // width: { ideal: 1280 },
          // height: { ideal: 720 },
          width: { ideal: 640 },  // <--- Add this
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: true
      };

      const mergedConstraints = {
        ...defaultConstraints,
        ...constraints
      };

      const stream = await navigator.mediaDevices.getUserMedia(mergedConstraints);
      
      streamRef.current = stream;
      setLocalStream(stream);
      setIsStreaming(true);
      
      // Get devices after permission granted
      await getDevices();
      
      console.log('✅ Media stream started');
      return stream;
    } catch (err) {
      console.error('Error starting media stream:', err);
      setError(err.message);
      setIsStreaming(false);
      throw err;
    }
  }, [getDevices]);

  // Stop media stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      streamRef.current = null;
      setLocalStream(null);
      setIsStreaming(false);
      console.log('✅ Media stream stopped');
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  // Switch camera
  const switchCamera = useCallback(async (deviceId) => {
    if (!streamRef.current) return;

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: true
    };

    stopStream();
    await startStream(constraints);
  }, [stopStream, startStream]);

  // Get stream settings
  const getStreamSettings = useCallback(() => {
    if (!streamRef.current) return null;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const audioTrack = streamRef.current.getAudioTracks()[0];

    return {
      video: videoTrack ? videoTrack.getSettings() : null,
      audio: audioTrack ? audioTrack.getSettings() : null
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    localStream,
    isStreaming,
    error,
    devices,
    startStream,
    stopStream,
    toggleAudio,
    toggleVideo,
    switchCamera,
    getStreamSettings,
    getDevices
  };
};