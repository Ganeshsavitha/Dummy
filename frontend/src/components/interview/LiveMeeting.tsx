import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Mic, MicOff, Monitor, PhoneOff, Send, MessageSquare, User, Calendar, Award, ShieldAlert } from 'lucide-react';
import type { Interview, Feedback } from './mockData';
import CandidateInfoPanel from './CandidateInfoPanel';
import EvaluationForm from './EvaluationForm';

interface Message {
  id: string;
  sender: string;
  senderRole: 'hr' | 'student';
  text: string;
  time: string;
}

interface LiveMeetingProps {
  interview: Interview;
  userRole: 'student' | 'hr';
  socket: any;
  onLeave: () => void;
  onSubmitEvaluation: (feedback: Feedback) => void;
}

export default function LiveMeeting({ interview, userRole, socket, onLeave, onSubmitEvaluation }: LiveMeetingProps) {
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'info'>('chat');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'HR Recruiter', senderRole: 'hr', text: 'Hello Alice, welcome to your technical assessment. Can you hear me clearly?', time: '10:01 AM' },
    { id: '2', sender: 'Alice Smith', senderRole: 'student', text: 'Yes, I can hear you loud and clear. Glad to be here!', time: '10:01 AM' }
  ]);
  const [inputText, setInputText] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // WebRTC Connection States
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Meeting timer ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebRTC Peer Connection & Signaling Setup
  useEffect(() => {
    let active = true;

    const setupRTC = async () => {
      try {
        console.log("[WebRTC] Requesting local camera and microphone permissions...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize Peer Connection with Public Google STUN servers
        console.log("[WebRTC] Creating RTCPeerConnection...");
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        peerConnectionRef.current = pc;

        // Add Local tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Debug state listeners
        pc.onconnectionstatechange = () => {
          console.log(`[WebRTC State] connectionState: ${pc.connectionState}`);
        };
        pc.oniceconnectionstatechange = () => {
          console.log(`[WebRTC State] iceConnectionState: ${pc.iceConnectionState}`);
        };
        pc.onsignalingstatechange = () => {
          console.log(`[WebRTC State] signalingState: ${pc.signalingState}`);
        };

        // ICE candidate callback
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("[WebRTC] Emitting ICE candidate to signaling server");
            socket.emit("ice-candidate", { meetingId: interview.meetingId, candidate: event.candidate });
          }
        };

        // Incoming track listener
        pc.ontrack = (event) => {
          console.log("[WebRTC] Received remote stream track event:", event);
          const remoteStream = event.streams[0];
          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            setRemoteStreamActive(true);
          }
        };

        // Signaling handlers
        socket.on("user-joined", async (data: any) => {
          console.log(`[WebRTC Signaling] Remote user joined: ${data.userRole}. Initiating offer...`);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { meetingId: interview.meetingId, offer });
          } catch (err) {
            console.error("[WebRTC] Failed to create offer:", err);
          }
        });

        socket.on("offer", async (data: any) => {
          console.log("[WebRTC Signaling] Received offer. Creating response answer...");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { meetingId: interview.meetingId, answer });
          } catch (err) {
            console.error("[WebRTC] Failed to handle offer:", err);
          }
        });

        socket.on("answer", async (data: any) => {
          console.log("[WebRTC Signaling] Received answer. Resolving remote description...");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch (err) {
            console.error("[WebRTC] Failed to handle answer:", err);
          }
        });

        socket.on("ice-candidate", async (data: any) => {
          console.log("[WebRTC Signaling] Received remote ICE candidate. Attaching...");
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error("[WebRTC] Failed to add ICE candidate:", err);
          }
        });

        socket.on("user-left", () => {
          console.log("[WebRTC] Remote user left call.");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          setRemoteStreamActive(false);
        });

        socket.on("chat-message", (data: any) => {
          setMessages(prev => [...prev, data.message]);
        });

        // Join room trigger
        socket.emit("join-meeting", {
          meetingId: interview.meetingId,
          userRole,
          userId: userRole === 'hr' ? interview.hrId : interview.studentId
        });

      } catch (err) {
        console.error("[WebRTC] Failed to initialize call:", err);
      }
    };

    setupRTC();

    return () => {
      active = false;
      console.log("[WebRTC] Closing meeting room...");
      
      socket.emit("leave-meeting", { meetingId: interview.meetingId });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      socket.off("chat-message");
    };
  }, [interview.meetingId]);

  // Synchronize audio/video active states to the local media stream tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = cameraActive;
      });
    }
  }, [cameraActive]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = micActive;
      });
    }
  }, [micActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: userRole === 'hr' ? 'HR Recruiter' : interview.studentName,
      senderRole: userRole,
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit("chat-message", { meetingId: interview.meetingId, message: newMsg });

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
  };

  const handleEndCall = () => {
    if (userRole === 'hr') {
      setShowEvaluation(true);
    } else {
      onLeave();
    }
  };

  if (showEvaluation) {
    return (
      <EvaluationForm 
        interview={interview} 
        onSubmit={(feedback) => {
          onSubmitEvaluation(feedback);
        }}
        onCancel={() => setShowEvaluation(false)}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', height: 'calc(100vh - 120px)', minHeight: '550px' }}>
      
      {/* Video Meeting Interface */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        <div 
          className="glass-panel" 
          style={{ 
            flex: 1, 
            position: 'relative', 
            background: '#090d16', 
            borderRadius: '16px', 
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {/* Main stream window: Remote Stream */}
          <video 
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              display: remoteStreamActive ? 'block' : 'none'
            }}
          />

          {!remoteStreamActive && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <User size={44} style={{ color: 'var(--text-muted)' }} />
              </div>
              <span style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                {userRole === 'hr' ? `${interview.studentName} (Candidate)` : `${interview.hrName} (Recruiter)`}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for remote user to join...</span>
            </div>
          )}

          {/* Sub thumbnail stream: Local Stream */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              width: '160px', 
              height: '110px', 
              background: '#1a2235', 
              border: '2px solid var(--primary)', 
              borderRadius: '8px', 
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}
          >
            <video 
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                display: cameraActive ? 'block' : 'none'
              }}
            />
            {!cameraActive && (
              <CameraOff size={16} style={{ color: 'var(--danger)' }} />
            )}
          </div>

          {/* Call Metadata (Header Indicators) */}
          <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '8px', color: '#fff', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: remoteStreamActive ? 'var(--success)' : 'var(--warning)', display: 'inline-block' }}></span>
              {remoteStreamActive ? 'Connected' : 'Waiting'}
            </div>
            <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '8px', color: '#fff', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
              {formatTime(timerSeconds)}
            </div>
          </div>

          {/* Screensharing Overlay Status */}
          {screenSharing && (
            <div style={{ position: 'absolute', top: '80px', left: '20px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.2)', padding: '6px 12px', borderRadius: '8px', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Monitor size={12} /> Sharing Screen...
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '12px 24px', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* Audio/Video mute */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-secondary" 
              style={{ 
                borderRadius: '50%', 
                width: '42px', 
                height: '42px', 
                padding: 0, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                background: micActive ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.2)',
                borderColor: micActive ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)',
                color: micActive ? 'var(--text-main)' : 'var(--danger)'
              }}
              onClick={() => setMicActive(!micActive)}
              title={micActive ? 'Mute' : 'Unmute'}
            >
              {micActive ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button 
              className="btn-secondary" 
              style={{ 
                borderRadius: '50%', 
                width: '42px', 
                height: '42px', 
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

          {/* Screen sharing */}
          <div>
            <button 
              className="btn-secondary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: screenSharing ? 'var(--primary-glow)' : 'rgba(255,255,255,0.05)',
                borderColor: screenSharing ? 'var(--primary)' : 'var(--border-color)',
                color: screenSharing ? 'var(--primary)' : 'var(--text-main)'
              }}
              onClick={() => setScreenSharing(!screenSharing)}
            >
              <Monitor size={16} /> {screenSharing ? 'Stop Sharing' : 'Share Screen'}
            </button>
          </div>

          {/* Disconnect/End call */}
          <div>
            <button 
              className="btn-danger" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'linear-gradient(135deg, var(--danger), #ef4444)' 
              }}
              onClick={handleEndCall}
            >
              <PhoneOff size={16} /> {userRole === 'hr' ? 'End Interview' : 'Leave Call'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Chat & Candidate Info) */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        {/* Navigation tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', gap: '8px', marginBottom: '16px' }}>
          <button 
            className={`btn-secondary ${activeTab === 'chat' ? 'active' : ''}`}
            style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={14} /> Live Chat
          </button>
          {userRole === 'hr' && (
            <button 
              className={`btn-secondary ${activeTab === 'info' ? 'active' : ''}`}
              style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveTab('info')}
            >
              <User size={14} /> Profile Panel
            </button>
          )}
        </div>

        {/* Tab contents */}
        {activeTab === 'chat' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: 'calc(100% - 60px)' }}>
            {/* Chats list */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {messages.map((msg) => {
                const isMe = (userRole === 'hr' && msg.senderRole === 'hr') || (userRole === 'student' && msg.senderRole === 'student');
                return (
                  <div 
                    key={msg.id} 
                    style={{ 
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: isMe ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      borderBottomRightRadius: isMe ? 0 : '8px',
                      borderBottomLeftRadius: isMe ? '8px' : 0,
                      border: isMe ? 'none' : '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', fontWeight: 'bold', marginBottom: '2px' }}>
                      {isMe ? 'You' : msg.sender}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#fff', wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.text}</div>
                    <div style={{ fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>{msg.time}</div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat form */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                placeholder="Send a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '38px', height: '38px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <CandidateInfoPanel studentId={interview.studentId} />
          </div>
        )}
      </div>

    </div>
  );
}
