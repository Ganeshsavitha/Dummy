import React from 'react';
import { User, FileText, Award, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { mockCandidates } from './mockData';
import type { Candidate } from './mockData';

interface CandidateInfoPanelProps {
  studentId: string;
}

export default function CandidateInfoPanel({ studentId }: CandidateInfoPanelProps) {
  // Find candidate by student ID (default to first mock student if not found)
  const candidate = mockCandidates.find(c => c.id === studentId) || mockCandidates[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', paddingRight: '6px' }}>
      
      {/* Profile summary card */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {candidate.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{candidate.name}</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{candidate.department} Candidate</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Academic CGPA</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '2px' }}>
              {candidate.cgpa} / 10.0
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Branch / Dept</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '2px' }}>
              {candidate.department}
            </div>
          </div>
        </div>
      </div>

      {/* Scores & Performance */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          <Award size={14} style={{ color: 'var(--primary)' }} /> Test & Assessment Scores
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.8rem' }}>MCQ Aptitude Score</span>
            <strong style={{ color: 'var(--success)' }}>{candidate.mcqScore}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.8rem' }}>Coding Assessment Score</span>
            <strong style={{ color: 'var(--primary)' }}>{candidate.codingScore}</strong>
          </div>
        </div>
      </div>

      {/* Skills tags */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          <Layers size={14} style={{ color: 'var(--primary)' }} /> Verified Skills
        </h4>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {candidate.skills.map((skill, index) => (
            <span 
              key={index} 
              style={{ 
                fontSize: '0.75rem', 
                background: 'rgba(99,102,241,0.08)', 
                color: 'var(--primary)', 
                padding: '4px 10px', 
                borderRadius: '12px', 
                border: '1px solid rgba(99,102,241,0.2)' 
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          <BookOpen size={14} style={{ color: 'var(--primary)' }} /> Key Academic Projects
        </h4>
        <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-main)' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>1. Automated Placement Proctoring Platform</div>
          <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Designed and built security features blocking clipboard shortcuts and verifying tab changes during recruitment exams.</p>
          
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>2. Full Stack E-Commerce Engine</div>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Created microservices architecture handling product inventory and payment verification interfaces.</p>
        </div>
      </div>

      {/* Resume Viewer */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          <FileText size={14} style={{ color: 'var(--primary)' }} /> Candidate Resume Text
        </h4>
        <div 
          style={{ 
            fontSize: '0.8rem', 
            lineHeight: '1.5', 
            color: 'var(--text-muted)', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '12px', 
            borderRadius: '8px', 
            maxHeight: '160px', 
            overflowY: 'auto',
            border: '1px solid var(--border-color)'
          }}
        >
          {candidate.resume}
        </div>
      </div>
      
    </div>
  );
}
