import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Link as LinkIcon, User, Layers, ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { Interview } from './mockData';

interface ScheduleFormProps {
  onBack: () => void;
  onScheduleAdded: (newInterview: Interview) => void;
}

export default function ScheduleForm({ onBack, onScheduleAdded }: ScheduleFormProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState('Technical');
  const [meetingId, setMeetingId] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch real students list from SQLite
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const API_BASE = window.location.origin;
        const res = await fetch(`${API_BASE}/api/placement/students`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setStudents(data.students);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      }
    };
    fetchStudents();
  }, []);

  const generateMeetingId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * 26)]).join('');
    const segment2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * 26)]).join('');
    const segment3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * 26)]).join('');
    const id = `meet-${segment1}-${segment2}-${segment3}`;
    setMeetingId(id);
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !date || !time || !meetingId) {
      alert('Please fill out all fields and generate a Meeting ID.');
      return;
    }

    const selectedStudent = students.find(s => s.id === studentId);
    if (!selectedStudent) return;

    const API_BASE = window.location.origin;
    fetch(`${API_BASE}/api/placement/interviews/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('hiregrad_token')}`
      },
      body: JSON.stringify({
        studentId: selectedStudent.id,
        date,
        time,
        duration,
        type,
        meetingId
      })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        onScheduleAdded(data.interview);
        setIsSuccess(true);
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        alert(data.message || 'Failed to schedule interview.');
      }
    }).catch(err => {
      console.error('Failed to schedule interview:', err);
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button 
        className="btn-secondary" 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 16px' }}
        onClick={onBack}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="glass-panel" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>Schedule One-to-One Interview</h3>
        <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Schedule a live, face-to-face WebRTC video interview with a student.
        </p>

        {isSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0', textAlign: 'center' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
            <h4 style={{ margin: 0, color: 'var(--success)' }}>Interview Scheduled Successfully!</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Redirecting to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Select Student</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <select 
                  className="form-control" 
                  style={{ paddingLeft: '38px', cursor: 'pointer' }}
                  value={studentId} 
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Candidate --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.department} - CGPA {s.cgpa || 'N/A'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Date</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="date" 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }}
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Start Time</label>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="time" 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }}
                    value={time} 
                    onChange={(e) => setTime(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Duration (Minutes)</label>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  <select 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }}
                    value={duration} 
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Interview Type</label>
                <div style={{ position: 'relative' }}>
                  <Layers size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  <select 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }}
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="Technical">Technical Round</option>
                    <option value="HR">HR Round</option>
                    <option value="Managerial">Managerial Round</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Meeting ID / Link Code</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <LinkIcon size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }}
                    placeholder="Generate unique code..."
                    value={meetingId}
                    readOnly
                    required
                  />
                </div>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ whiteSpace: 'nowrap', padding: '12px 18px' }}
                  onClick={generateMeetingId}
                >
                  Generate Link
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '14px' }}
            >
              <Calendar size={16} /> Confirm schedule & Notify Student
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
