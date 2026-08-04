import React, { useState } from 'react';
import { Calendar, Clock, Star, MessageSquare, Award, TrendingUp, CheckCircle, XCircle, AlertCircle, Eye, ArrowLeft } from 'lucide-react';
import { mockFeedbackList } from './mockData';
import type { Interview, Feedback } from './mockData';

interface InterviewHistoryProps {
  interviews: Interview[];
  userRole: 'student' | 'hr';
  onBack?: () => void;
}

export default function InterviewHistory({ interviews, userRole, onBack }: InterviewHistoryProps) {
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  const completed = interviews.filter(i => i.status === 'completed');

  const getResultBadge = (result: 'selected' | 'rejected' | 'hold' | undefined) => {
    if (!result) return <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '20px' }}>Pending</span>;
    switch (result) {
      case 'selected':
        return <span style={{ fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Selected</span>;
      case 'rejected':
        return <span style={{ fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Rejected</span>;
      case 'hold':
        return <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>On Hold</span>;
    }
  };

  const getFeedbackDetails = (interviewId: string) => {
    return mockFeedbackList[interviewId];
  };

  if (selectedInterview) {
    const feedback = getFeedbackDetails(selectedInterview.id);
    return (
      <div>
        <button 
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 16px' }}
          onClick={() => setSelectedInterview(null)}
        >
          <ArrowLeft size={16} /> Back to History
        </button>

        <div className="glass-panel" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.35rem' }}>Interview Performance Summary</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {userRole === 'student' ? 'Company Name: HireGrad Hiring Corp' : `Candidate: ${selectedInterview.studentName}`} | {selectedInterview.type} round
              </p>
            </div>
            <div>
              {feedback ? getResultBadge(feedback.result) : getResultBadge(undefined)}
            </div>
          </div>

          {feedback ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Scores grid */}
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Performance Ratings
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'Technical Skills', score: feedback.technicalScore },
                    { label: 'Communication', score: feedback.communicationScore },
                    { label: 'Confidence Level', score: feedback.confidenceScore },
                    { label: 'Problem Solving', score: feedback.problemSolvingScore }
                  ].map((item, index) => (
                    <div key={index} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>{item.label}</span>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{item.score} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 10</span></strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall metric */}
              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <Star size={18} style={{ color: 'var(--primary)' }} /> Average Overall Rating
                </span>
                <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{feedback.overallRating} / 10</strong>
              </div>

              {/* Recruiter feedback comments */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Interviewer Feedback Comments
                </h4>
                <p style={{ margin: 0, padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '0.9rem', lineHeight: '1.5', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                  {feedback.comments}
                </p>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)' }}>
              <AlertCircle size={28} />
              <div style={{ fontSize: '0.95rem' }}>Evaluation scores are still pending submission by the recruiter. Check back later.</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {onBack && (
        <button 
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 16px' }}
          onClick={onBack}
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Completed Interview Logs</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Review past technical rounds, comments, and selection reports
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {completed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: 'var(--text-muted)' }}>
            <AlertCircle size={28} />
            <div style={{ fontSize: '0.95rem' }}>No completed interviews in history logs.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {completed.map((interview) => {
              const feedback = getFeedbackDetails(interview.id);
              return (
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
                    <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '12px', borderRadius: '10px' }}>
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {userRole === 'student' ? 'Technical Assessment (HireGrad Hiring)' : interview.studentName}
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
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {feedback ? (
                      <>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rating: </span>
                          <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{feedback.overallRating}/10</strong>
                        </div>
                        {getResultBadge(feedback.result)}
                      </>
                    ) : (
                      getResultBadge(undefined)
                    )}
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setSelectedInterview(interview)}
                    >
                      <Eye size={12} /> View Evaluation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
