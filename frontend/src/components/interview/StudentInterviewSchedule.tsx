import React from 'react';
import { Calendar, Clock, Video, AlertCircle, HelpCircle } from 'lucide-react';
import type { Interview } from './mockData';

interface StudentInterviewScheduleProps {
  interviews: Interview[];
  onJoinLobby: (interview: Interview) => void;
}

export default function StudentInterviewSchedule({ interviews, onJoinLobby }: StudentInterviewScheduleProps) {
  // Student sees interviews assigned to student
  const upcoming = interviews.filter(i => i.status === 'scheduled' || i.status === 'waiting' || i.status === 'ongoing');

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>My Interview Schedule</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Track and join your scheduled live technical and HR interviews with recruiters.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} /> Scheduled Rounds
        </h3>

        {upcoming.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <AlertCircle size={28} />
            <div style={{ fontSize: '0.95rem' }}>No upcoming live interviews scheduled for you yet.</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Recruiters will schedule rounds once your placement drives assessment scores are shortlisted.
            </p>
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
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px' 
                }}
              >
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
                    <Video size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {interview.type} Round
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '20px', color: 'var(--primary)' }}>
                        HireGrad Recruiter
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
                        Meeting Code: {interview.meetingId}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => onJoinLobby(interview)}
                  >
                    <Video size={14} /> Enter Lobby
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helpful Instructions */}
      <div className="glass-panel" style={{ marginTop: '24px', background: 'rgba(99,102,241,0.02)', borderColor: 'rgba(99,102,241,0.1)' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HelpCircle size={16} style={{ color: 'var(--primary)' }} /> How it works:
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          <li>Select **Enter Lobby** near your scheduled interview time.</li>
          <li>Test your camera and microphone in the waiting room to verify connection status.</li>
          <li>Remain in the waiting room lobby. The HR Recruiter will admit you into the live video call once they are ready.</li>
        </ul>
      </div>
    </div>
  );
}
