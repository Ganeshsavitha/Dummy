import React, { useState } from 'react';
import { Calendar, Filter, Search, Award, CheckCircle, BarChart3, AlertCircle } from 'lucide-react';
import { mockInterviews } from './mockData';
import type { Interview } from './mockData';

export default function AdminReports() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredInterviews = mockInterviews.filter(item => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch = item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.hrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.meetingId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'ongoing':
        return { background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)' };
      case 'waiting':
        return { background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'cancelled':
        return { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Global Interview Reports</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Monitor scheduling patterns, success rates, and live interview statistics across all recruiters and students.
        </p>
      </div>

      {/* Aggregate Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Conducted</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{mockInterviews.length}</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Avg. Session Time</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>45 Mins</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Selection Rate</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)' }}>66.7 %</span>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Recruiter Accounts</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>8 Active</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by student, recruiter, or meeting ID..." 
              style={{ paddingLeft: '38px', fontSize: '0.85rem', height: '40px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} /> Filter Status:
          </span>
          <select 
            className="form-control" 
            style={{ width: '140px', fontSize: '0.85rem', height: '40px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="waiting">Waiting Lobby</option>
            <option value="ongoing">Ongoing Call</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table List */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>Meeting ID</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Candidate</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Interviewer</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Scheduled Time</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Round Type</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-muted)', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterviews.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={24} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                  No matching interview logs found.
                </td>
              </tr>
            ) : (
              filteredInterviews.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 'bold' }}>{item.meetingId}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.studentName}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.studentEmail}</span>
                  </td>
                  <td style={{ padding: '16px' }}>{item.hrName}</td>
                  <td style={{ padding: '16px' }}>
                    <div>{item.date}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.time} ({item.duration}m)</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '4px' }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontWeight: 'bold', 
                        display: 'inline-block',
                        ...getStatusStyle(item.status)
                      }}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
