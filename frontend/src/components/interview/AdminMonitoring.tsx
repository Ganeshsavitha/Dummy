import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Activity, Power, LogIn, AlertCircle } from 'lucide-react';
import { mockInterviews } from './mockData';
import type { Interview } from './mockData';

export default function AdminMonitoring() {
  const [activeSessions, setActiveSessions] = useState<Interview[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load mock active sessions (status is waiting or ongoing or scheduled for today)
  useEffect(() => {
    setActiveSessions(mockInterviews.filter(i => i.status !== 'completed' && i.status !== 'cancelled'));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const terminateSession = (id: string) => {
    if (window.confirm('Are you sure you want to forcibly terminate this meeting session?')) {
      setActiveSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Active Meeting Monitor</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Track WebRTC signaling channels, connection drops, and hardware quality reports in real-time.
          </p>
        </div>
        <button 
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} style={{ color: 'var(--primary)' }} /> Live Rooms Status
        </h3>

        {activeSessions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)' }}>
            <AlertCircle size={28} />
            <div style={{ fontSize: '0.95rem' }}>No active meetings currently running.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeSessions.map((session) => (
              <div 
                key={session.id} 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '20px', 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px' 
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {session.meetingId}
                    </span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px' }}>
                      {session.type} round
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }}></span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 'bold' }}>Active Channel</span>
                  </div>
                </div>

                {/* Details layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Candidate Presence</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></div>
                      {session.studentName} (Connected)
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Ping: 22ms | Packet loss: 0%</span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recruiter Presence</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></div>
                      {session.hrName} (Connected)
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Ping: 15ms | Packet loss: 0%</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '6px 12px', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => terminateSession(session.id)}
                    >
                      <Power size={12} /> Force Kill Room
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
