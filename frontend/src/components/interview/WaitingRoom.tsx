import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, MicOff, CameraOff, Video, Cpu, ShieldCheck, Play, ArrowLeft, RefreshCw, Volume2, User, ShieldAlert } from 'lucide-react';
import type { Interview } from './mockData';

interface WaitingRoomProps {
  interview: Interview;
  userRole: 'student' | 'hr';
  onBack: () => void;
  onEnterCall: () => void;
}

export default function WaitingRoom({ interview, userRole, onBack, onEnterCall }: WaitingRoomProps) {
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [pingStatus, setPingStatus] = useState({ ping: 18, rating: 'Excellent', bandwidth: '75 Mbps' });
  const [micVolume, setMicVolume] = useState<number[]>([5, 5, 5, 5, 5, 5, 5, 5]);
  const [isMeasuringPing, setIsMeasuringPing] = useState(false);
  
  // Media Devices state
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stop and clean up all media resources
  const stopMedia = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Enumerate all available audio and video input devices
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');

      setCameras(videoDevices);
      setMicrophones(audioDevices);

      // Select default device ids if not already chosen
      if (streamRef.current) {
        const activeVideoTrack = streamRef.current.getVideoTracks()[0];
        const activeAudioTrack = streamRef.current.getAudioTracks()[0];

        if (activeVideoTrack) {
          const settings = activeVideoTrack.getSettings();
          if (settings.deviceId && !selectedCamId) {
            setSelectedCamId(settings.deviceId);
          }
        }

        if (activeAudioTrack) {
          const settings = activeAudioTrack.getSettings();
          if (settings.deviceId && !selectedMicId) {
            setSelectedMicId(settings.deviceId);
          }
        }
      }
    } catch (err) {
      console.error('Error enumerating hardware devices:', err);
    }
  };

  // Setup Web Audio API AnalyserNode for mic volumes
  const startAudioAnalyser = (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32; // Small size for simple 8-bar visualizer
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current || !micActive) {
          setMicVolume([5, 5, 5, 5, 5, 5, 5, 5]);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);

        const newVolume: number[] = [];
        const step = Math.max(Math.floor(bufferLength / 8), 1);

        for (let i = 0; i < 8; i++) {
          let sum = 0;
          let count = 0;
          for (let j = i * step; j < (i + 1) * step && j < bufferLength; j++) {
            sum += dataArray[j];
            count++;
          }
          const val = count > 0 ? sum / count : 0;
          const percentage = Math.round((val / 255) * 100);
          newVolume.push(Math.max(percentage, 5));
        }

        setMicVolume(newVolume);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animationFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.error('Failed to initialize audio level analyser:', err);
    }
  };

  // Request browser permissions and load streams
  const initMedia = async (camId?: string, micId?: string) => {
    try {
      setErrorMessage(null);
      stopMedia();

      // Setup audio and video constraints
      const videoConstraint = camId ? { deviceId: { exact: camId } } : true;
      const audioConstraint = micId ? { deviceId: { exact: micId } } : true;

      const constraints: MediaStreamConstraints = {
        video: videoConstraint,
        audio: audioConstraint
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Configure tracks
      stream.getVideoTracks().forEach(t => t.enabled = cameraActive);
      stream.getAudioTracks().forEach(t => t.enabled = micActive);

      // Start level meter
      startAudioAnalyser(stream);

      // Refresh device names now that permission is granted
      await enumerateDevices();
    } catch (err: any) {
      console.error('Browser media access failed:', err);
      let msg = 'Failed to load media devices. ';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera or Microphone permission denied. Please grant media permissions in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera or microphone hardware detected on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Your camera or microphone is already in use by another browser tab or app.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback to default constraints if device ID constraint fails
        console.warn('Overconstrained devices. Retrying with defaults...');
        initMedia();
        return;
      } else {
        msg += err.message || '';
      }
      setErrorMessage(msg);
    }
  };

  // Run on mount
  useEffect(() => {
    initMedia();

    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      stopMedia();
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  // Update track enabled states when micActive or cameraActive toggles
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = cameraActive);
    }
  }, [cameraActive]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = micActive);
    }
  }, [micActive]);

  // Dropdown selectors
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCamId = e.target.value;
    setSelectedCamId(newCamId);
    initMedia(newCamId, selectedMicId);
  };

  const handleMicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMicId = e.target.value;
    setSelectedMicId(newMicId);
    initMedia(selectedCamId, newMicId);
  };

  const testConnection = () => {
    setIsMeasuringPing(true);
    setTimeout(() => {
      const p = Math.floor(Math.random() * 30) + 12;
      let rating = 'Excellent';
      if (p > 50) rating = 'Good';
      if (p > 100) rating = 'Poor';
      setPingStatus({
        ping: p,
        rating,
        bandwidth: `${(Math.random() * 50 + 40).toFixed(1)} Mbps`
      });
      setIsMeasuringPing(false);
    }, 1500);
  };

  return (
    <div>
      <button 
        className="btn-secondary" 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 16px' }}
        onClick={() => {
          stopMedia();
          onBack();
        }}
      >
        <ArrowLeft size={16} /> Exit Lobby
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
        {/* Left Column: Webcam & Device Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div 
            className="glass-panel" 
            style={{ 
              height: '350px', 
              position: 'relative', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {errorMessage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--danger)', padding: '24px', textAlign: 'center' }}>
                <ShieldAlert size={44} />
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Media Hardware Blocked</span>
                <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>{errorMessage}</p>
              </div>
            ) : cameraActive ? (
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--danger)' }}>
                <CameraOff size={48} />
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Camera is Turned Off</span>
              </div>
            )}

            {/* Toggle Overlay Controls */}
            <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '10px' }}>
              <button 
                className="btn-secondary" 
                style={{ 
                  borderRadius: '50%', 
                  width: '40px', 
                  height: '40px', 
                  padding: 0, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  background: micActive ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: micActive ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)',
                  color: micActive ? 'var(--text-main)' : 'var(--danger)'
                }}
                onClick={() => setMicActive(!micActive)}
                title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micActive ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button 
                className="btn-secondary" 
                style={{ 
                  borderRadius: '50%', 
                  width: '40px', 
                  height: '40px', 
                  padding: 0, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  background: cameraActive ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: cameraActive ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)',
                  color: cameraActive ? 'var(--text-main)' : 'var(--danger)'
                }}
                onClick={() => setCameraActive(!cameraActive)}
                title={cameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {cameraActive ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>
            </div>
          </div>

          {/* Micro volume audio indicators */}
          {micActive && !errorMessage && (
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <Volume2 size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Microphone Test:</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '24px', width: '100%' }}>
                {micVolume.map((vol, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      height: `${vol}%`, 
                      width: '4px', 
                      background: vol > 75 ? 'var(--danger)' : vol > 45 ? 'var(--warning)' : 'var(--primary)', 
                      borderRadius: '2px',
                      transition: 'height 0.08s ease'
                    }}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Settings & Waiting Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--primary)' }} /> Device Checks
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Camera Device</label>
                <select 
                  className="form-control" 
                  value={selectedCamId} 
                  onChange={handleCameraChange}
                  style={{ fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {cameras.length === 0 ? (
                    <option value="">No Camera Detected</option>
                  ) : (
                    cameras.map(cam => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera Device (${cam.deviceId.slice(0, 8)})`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Audio Input (Microphone)</label>
                <select 
                  className="form-control" 
                  value={selectedMicId} 
                  onChange={handleMicChange}
                  style={{ fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {microphones.length === 0 ? (
                    <option value="">No Microphone Detected</option>
                  ) : (
                    microphones.map(mic => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone Device (${mic.deviceId.slice(0, 8)})`}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--success)' }} /> Network Status
              </span>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={testConnection}
                disabled={isMeasuringPing}
              >
                {isMeasuringPing ? <RefreshCw size={10} className="spin" /> : 'Retest'}
              </button>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ping Latency</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '4px' }}>
                  {pingStatus.ping} ms
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connection Quality</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '4px' }}>
                  {pingStatus.rating}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              Estimated Bandwidth: <strong style={{ color: 'var(--text-main)' }}>{pingStatus.bandwidth}</strong>
            </div>
          </div>

          {/* Lobby Entry & Status Details */}
          <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'rgba(99,102,241,0.03)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            {userRole === 'student' ? (
              <>
                <div className="pulse-circle" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--warning)' }}>
                  <RefreshCw size={24} className="spin" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>Waiting for HR Admission</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    You are in the lobby for **{interview.type} Round** with **{interview.hrName}**. The interviewer has been notified.
                  </p>
                </div>
                {/* For mock testing, allow student to click to enter directly */}
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  onClick={() => {
                    stopMedia();
                    onEnterCall();
                  }}
                >
                  <Play size={16} /> Enter Meeting (Mock Direct Admission)
                </button>
              </>
            ) : (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success)' }}>
                  <Video size={24} />
                </div>
                <div style={{ width: '100%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>Candidate Lobby</h4>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    **{interview.studentName}** ({interview.studentEmail}) is waiting in the room lobby.
                  </p>
                  <button 
                    className="btn-primary" 
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    onClick={() => {
                      stopMedia();
                      onEnterCall();
                    }}
                  >
                    <Play size={16} /> Admit Candidate & Start Call
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
