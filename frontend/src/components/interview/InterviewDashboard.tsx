import React from 'react';
import { Calendar, Clock, Video, User, Plus, Award, AlertCircle } from 'lucide-react';
import type { Interview } from './mockData';

interface InterviewDashboardProps {
  interviews: Interview[];
  onScheduleClick: () => void;
  onJoinCall: (interview: Interview) => void;
  onViewHistory: () => void;
}

export default function InterviewDashboard({ interviews, onScheduleClick, onJoinCall, onViewHistory }: InterviewDashboardProps) {
  const upcoming = interviews.filter(i => i.status === 'scheduled' || i.status === 'waiting' || i.status === 'ongoing');
  const completed = interviews.filter(i => i.status === 'completed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>HR Live Interview Hub</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Schedule and conduct real recruiter-to-student face-to-face video rounds
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={onViewHistory}
          >
            History & Decisions
          </button>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={onScheduleClick}
          >
            <Plus size={16} /> Schedule Interview
          </button>
        </div>
      </div>

      {/* Analytics widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Interviews</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{interviews.length}</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upcoming Scheduled</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)' }}>{upcoming.length}</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Completed Evaluations</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>{completed.length}</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Meeting Server Status</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
            Online & Ready
          </span>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} /> Upcoming Live Interviews
        </h3>

        {upcoming.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <AlertCircle size={28} />
            <div style={{ fontSize: '0.95rem' }}>No live interviews scheduled yet.</div>
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={onScheduleClick}>
              Create First Schedule
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {upcoming.map((interview) => (
              <div 
                key={interview.id} 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px' 
                }}
              >
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
                    <Video size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {interview.studentName}
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '20px', color: 'var(--text-muted)' }}>
                        {interview.type} Round
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {interview.date}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> {interview.time} ({interview.duration} mins)
                      </span>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                        ID: {interview.meetingId}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {interview.status === 'waiting' && (
                    <span style={{ fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="ping-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></span>
                      Student Waiting
                    </span>
                  )}
                  <button 
                    className="btn-primary" 
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => onJoinCall(interview)}
                  >
                    <Video size={14} /> Join Meeting
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
