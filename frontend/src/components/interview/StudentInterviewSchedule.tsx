import React, { useState } from 'react';
import { Calendar, Clock, Video, AlertCircle, HelpCircle, Check, X } from 'lucide-react';
import type { Interview } from './mockData';

interface StudentInterviewScheduleProps {
  interviews: Interview[];
  onJoinLobby: (interview: Interview) => void;
  onInvitationUpdated: (interview: Interview) => void;
}

export default function StudentInterviewSchedule({ interviews, onJoinLobby, onInvitationUpdated }: StudentInterviewScheduleProps) {
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const upcoming = interviews.filter(i => ['scheduled', 'waiting', 'ongoing'].includes(i.status));

  const respondToInvite = async (interview: Interview, response: 'accepted' | 'declined') => {
    setRespondingId(interview.id);
    try {
      const res = await fetch(`${window.location.origin}/api/placement/interviews/${interview.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}` },
        body: JSON.stringify({ response })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to update invitation.');
      onInvitationUpdated(data.interview);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update invitation.');
    } finally {
      setRespondingId(null);
    }
  };

  const canJoinNow = (interview: Interview) => {
    if (interview.invitationStatus !== 'accepted') return false;
    const start = new Date(`${interview.date}T${interview.time}:00`).getTime();
    const now = Date.now();
    return now >= start - 15 * 60_000 && now <= start + (interview.duration + 15) * 60_000;
  };

  return <div>
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ margin: 0 }}>My Interview Invitations</h2>
      <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Accept an HR invitation, then join the live interview at the scheduled time.
      </p>
    </div>

    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={18} style={{ color: 'var(--primary)' }} /> Invitations & Scheduled Rounds
      </h3>
      {upcoming.length === 0 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
        <AlertCircle size={28} />
        <div>No interview invitations yet.</div>
      </div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {upcoming.map(interview => {
          const inviteStatus = interview.invitationStatus || 'pending';
          const joinOpen = canJoinNow(interview);
          return <div key={interview.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}><Video size={24} /></div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {interview.type} Round
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '20px', color: 'var(--primary)' }}>{interview.hrName || 'HR Recruiter'}</span>
                  <span style={{ fontSize: '0.72rem', textTransform: 'capitalize', color: inviteStatus === 'accepted' ? 'var(--success)' : inviteStatus === 'declined' ? 'var(--danger)' : 'var(--warning)' }}>{inviteStatus}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {interview.date}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {interview.time} ({interview.duration} mins)</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Meeting Code: {interview.meetingId}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {inviteStatus === 'pending' ? <>
                <button className="btn-primary" disabled={respondingId === interview.id} onClick={() => respondToInvite(interview, 'accepted')}><Check size={14} /> Accept</button>
                <button className="btn-secondary" disabled={respondingId === interview.id} onClick={() => respondToInvite(interview, 'declined')}><X size={14} /> Decline</button>
              </> : inviteStatus === 'declined' ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Invitation declined</span> :
                <button className="btn-primary" onClick={() => onJoinLobby(interview)} disabled={!joinOpen} title={joinOpen ? 'Enter interview lobby' : 'Lobby opens 15 minutes before the scheduled time'}>
                  <Video size={14} /> {joinOpen ? 'Enter Lobby' : 'Accepted — Not Open Yet'}
                </button>}
            </div>
          </div>;
        })}
      </div>}
    </div>

    <div className="glass-panel" style={{ marginTop: '24px', background: 'rgba(99,102,241,0.02)', borderColor: 'rgba(99,102,241,0.1)' }}>
      <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}><HelpCircle size={16} style={{ color: 'var(--primary)' }} /> How it works</h4>
      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
        <li>Accept the HR invitation to confirm your attendance.</li>
        <li>The lobby opens 15 minutes before the scheduled time.</li>
        <li>Test your camera and microphone, then wait for the HR recruiter to start the call.</li>
      </ul>
    </div>
  </div>;
}
