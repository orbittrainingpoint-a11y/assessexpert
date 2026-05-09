'use client'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi } from '@/lib/api'
import { Calendar, Clock, User, Building2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

type TabType = 'upcoming' | 'past' | 'all'

export default function ProctorSessionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  
  const { data, isLoading } = useQuery({
    queryKey: ['proctor-all-sessions'],
    queryFn: () => sessionsApi.getAll({ limit: 1000 }).then(r => r.data),
  })

  const sessions = data?.sessions || []
  const now = new Date()

  const upcoming = sessions.filter((s: any) => new Date(s.scheduledAt) > now)
  const past = sessions.filter((s: any) => new Date(s.scheduledAt) <= now)

  const displaySessions = activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : sessions

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>All Sessions</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>View all your scheduled and completed sessions</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '2px solid var(--cyan)' : '2px solid transparent',
            color: activeTab === 'upcoming' ? 'var(--cyan)' : 'var(--text-muted)',
            fontWeight: activeTab === 'upcoming' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'past' ? '2px solid var(--cyan)' : '2px solid transparent',
            color: activeTab === 'past' ? 'var(--cyan)' : 'var(--text-muted)',
            fontWeight: activeTab === 'past' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Past ({past.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all' ? '2px solid var(--cyan)' : '2px solid transparent',
            color: activeTab === 'all' ? 'var(--cyan)' : 'var(--text-muted)',
            fontWeight: activeTab === 'all' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          All ({sessions.length})
        </button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading sessions...</p>
        </div>
      ) : displaySessions.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <Calendar size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {activeTab === 'upcoming' ? 'No upcoming sessions' : activeTab === 'past' ? 'No past sessions' : 'No sessions found'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displaySessions.map((session: any) => {
            const scheduledDate = new Date(session.scheduledAt)
            const isPast = scheduledDate <= now
            const isToday = scheduledDate.toDateString() === now.toDateString()
            
            return (
              <div key={session.id} className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {session.candidate?.firstName} {session.candidate?.lastName}
                      </h3>
                      <span className={`badge ${
                        session.status === 'MCQ_IN_PROGRESS' || session.status === 'PRACTICAL_IN_PROGRESS' ? 'badge-live' :
                        session.status === 'REPORT_PUBLISHED' ? 'badge-pass' :
                        session.status === 'SCHEDULED' ? 'badge-pending' :
                        session.status === 'DISQUALIFIED' ? 'badge-fail' : 'badge-pending'
                      }`}>
                        {session.status.replace(/_/g, ' ')}
                      </span>
                      {isToday && !isPast && (
                        <span className="badge badge-live" style={{ fontSize: '11px' }}>TODAY</span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Date</p>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {scheduledDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Time</p>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Company</p>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {session.organization?.name || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={16} style={{ color: 'var(--text-muted)' }} />
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {session.assessmentType?.name || 'Assessment'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {session.status === 'SCHEDULED' && isToday && (
                      <Link href={`/proctor/session?id=${session.id}`} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                        Join Session
                      </Link>
                    )}
                    {(session.status === 'MCQ_IN_PROGRESS' || session.status === 'PRACTICAL_IN_PROGRESS') && (
                      <Link href={`/proctor/session?id=${session.id}`} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                        Continue Session
                      </Link>
                    )}
                    {(session.status === 'SUBMITTED' || session.status === 'REPORT_PUBLISHED') && (
                      <Link href={`/proctor/reports/${session.id}`} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                        View Report
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
