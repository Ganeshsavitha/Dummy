import React, { useState, useEffect } from 'react';
import { Award, Star, MessageSquare, Check, AlertCircle } from 'lucide-react';
import type { Interview, Feedback } from './mockData';

interface EvaluationFormProps {
  interview: Interview;
  onSubmit: (feedback: Feedback) => void;
  onCancel?: () => void;
}

export default function EvaluationForm({ interview, onSubmit, onCancel }: EvaluationFormProps) {
  const [commScore, setCommScore] = useState(7);
  const [techScore, setTechScore] = useState(7);
  const [confScore, setConfScore] = useState(7);
  const [probScore, setProbScore] = useState(7);
  const [overallRating, setOverallRating] = useState(7);
  const [comments, setComments] = useState('');
  const [result, setResult] = useState<'selected' | 'rejected' | 'hold'>('selected');

  // Automatically recalculate overall rating based on weights
  useEffect(() => {
    const average = (commScore + techScore + confScore + probScore) / 4;
    setOverallRating(parseFloat(average.toFixed(1)));
  }, [commScore, techScore, confScore, probScore]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) {
      alert('Please provide evaluation feedback notes.');
      return;
    }

    const feedback: Feedback = {
      interviewId: interview.id,
      communicationScore: commScore,
      technicalScore: techScore,
      confidenceScore: confScore,
      problemSolvingScore: probScore,
      overallRating,
      comments,
      result
    };

    onSubmit(feedback);
  };

  const renderScoreButtons = (currentVal: number, setVal: (v: number) => void) => {
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            className="btn-secondary"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '6px',
              background: currentVal === num ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
              borderColor: currentVal === num ? 'var(--primary)' : 'var(--border-color)',
              color: currentVal === num ? '#fff' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setVal(num)}
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.4rem' }}>Candidate Evaluation Form</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Round evaluation for **{interview.studentName}** ({interview.type} round)
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(99,102,241,0.08)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.15)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Score</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '2px' }}>
              {overallRating} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 10</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Performance Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Communication Skills</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score: {commScore}/10</span>
              </div>
              {renderScoreButtons(commScore, setCommScore)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Technical Concepts</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score: {techScore}/10</span>
              </div>
              {renderScoreButtons(techScore, setTechScore)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Confidence & Attitude</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score: {confScore}/10</span>
              </div>
              {renderScoreButtons(confScore, setConfScore)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Problem Solving Capability</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score: {probScore}/10</span>
              </div>
              {renderScoreButtons(probScore, setProbScore)}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* Hiring outcome decision */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Hiring Status Recommendation</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: result === 'selected' ? 'var(--success-glow)' : 'rgba(255,255,255,0.02)',
                  borderColor: result === 'selected' ? 'var(--success)' : 'var(--border-color)',
                  color: result === 'selected' ? 'var(--success)' : 'var(--text-muted)'
                }}
                onClick={() => setResult('selected')}
              >
                {result === 'selected' && <Check size={16} />} Selected
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: result === 'hold' ? 'var(--warning-glow)' : 'rgba(255,255,255,0.02)',
                  borderColor: result === 'hold' ? 'var(--warning)' : 'var(--border-color)',
                  color: result === 'hold' ? 'var(--warning)' : 'var(--text-muted)'
                }}
                onClick={() => setResult('hold')}
              >
                {result === 'hold' && <Check size={16} />} Hold
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: result === 'rejected' ? 'var(--danger-glow)' : 'rgba(255,255,255,0.02)',
                  borderColor: result === 'rejected' ? 'var(--danger)' : 'var(--border-color)',
                  color: result === 'rejected' ? 'var(--danger)' : 'var(--text-muted)'
                }}
                onClick={() => setResult('rejected')}
              >
                {result === 'rejected' && <Check size={16} />} Rejected
              </button>
            </div>
          </div>

          {/* Feedback comments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Evaluation Feedback Notes</label>
            <div style={{ position: 'relative' }}>
              <MessageSquare size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
              <textarea
                className="form-control"
                style={{ paddingLeft: '38px', minHeight: '120px', resize: 'vertical' }}
                placeholder="Enter detailed feedback regarding coding performance, communication clarity, strengths, and improvement suggestions..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '8px' }}>
            {onCancel && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '10px 24px' }}
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '10px 28px', background: 'linear-gradient(135deg, var(--success), #059669)', border: 'none' }}
            >
              Submit Evaluation
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
