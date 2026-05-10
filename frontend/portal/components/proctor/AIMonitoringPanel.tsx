'use client'
import { AlertTriangle, Eye, Users, Hand, Monitor, TrendingDown, TrendingUp } from 'lucide-react'
import { AIAlert, BehaviorScore } from '@/lib/useMediaPipe'

interface AIMonitoringPanelProps {
  alerts: AIAlert[]
  behaviorScore: BehaviorScore | null
  isMonitoring: boolean
  onDismissAlert: (alertId: string) => void
}

export default function AIMonitoringPanel({ alerts, behaviorScore, isMonitoring, onDismissAlert }: AIMonitoringPanelProps) {
  const getAlertIcon = (type: AIAlert['type']) => {
    switch (type) {
      case 'multiple_faces': return <Users size={16} />
      case 'face_absent': return <Eye size={16} />
      case 'looking_away': return <Eye size={16} />
      case 'hand_near_face': return <Hand size={16} />
      case 'gaze_offscreen': return <Monitor size={16} />
    }
  }

  const getRiskColor = (level: BehaviorScore['riskLevel']) => {
    switch (level) {
      case 'LOW': return 'var(--emerald)'
      case 'MEDIUM': return 'var(--amber)'
      case 'HIGH': return 'var(--orange)'
      case 'CRITICAL': return 'var(--rose)'
    }
  }

  const recentAlerts = alerts.slice(0, 5)

  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--cyan)' }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Monitoring</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isMonitoring ? 'var(--emerald)' : 'var(--text-muted)' }} />
          <span style={{ fontSize: '11px', color: isMonitoring ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: '600' }}>
            {isMonitoring ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>

      {/* Behavior Score */}
      {behaviorScore && (
        <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: `1px solid ${getRiskColor(behaviorScore.riskLevel)}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Behavior Score</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {behaviorScore.score >= 80 ? <TrendingUp size={14} style={{ color: 'var(--emerald)' }} /> : <TrendingDown size={14} style={{ color: 'var(--rose)' }} />}
              <span style={{ fontSize: '20px', fontWeight: '700', color: getRiskColor(behaviorScore.riskLevel) }}>
                {behaviorScore.score}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Risk Level</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: getRiskColor(behaviorScore.riskLevel) }}>
              {behaviorScore.riskLevel}
            </span>
          </div>
          
          {/* Violations Summary */}
          {Object.values(behaviorScore.violations).some(v => v > 0) && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {behaviorScore.violations.multipleFaces > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Multiple Faces</span>
                  <span style={{ color: 'var(--rose)', fontWeight: '600' }}>{behaviorScore.violations.multipleFaces}</span>
                </div>
              )}
              {behaviorScore.violations.faceAbsent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Face Absent</span>
                  <span style={{ color: 'var(--rose)', fontWeight: '600' }}>{behaviorScore.violations.faceAbsent}</span>
                </div>
              )}
              {behaviorScore.violations.lookingAway > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Looking Away</span>
                  <span style={{ color: 'var(--amber)', fontWeight: '600' }}>{behaviorScore.violations.lookingAway}</span>
                </div>
              )}
              {behaviorScore.violations.handNearFace > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Hand Near Face</span>
                  <span style={{ color: 'var(--amber)', fontWeight: '600' }}>{behaviorScore.violations.handNearFace}</span>
                </div>
              )}
              {behaviorScore.violations.gazeOffscreen > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gaze Offscreen</span>
                  <span style={{ color: 'var(--amber)', fontWeight: '600' }}>{behaviorScore.violations.gazeOffscreen}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Alerts */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
          Recent Alerts ({alerts.length})
        </p>
        {recentAlerts.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
            No alerts detected
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentAlerts.map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '10px',
                  background: alert.severity === 'critical' ? 'rgba(225,29,72,0.08)' : 'rgba(215,119,6,0.08)',
                  border: `1px solid ${alert.severity === 'critical' ? 'rgba(225,29,72,0.3)' : 'rgba(215,119,6,0.3)'}`,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <div style={{ color: alert.severity === 'critical' ? 'var(--rose)' : 'var(--amber)', marginTop: '2px' }}>
                  {getAlertIcon(alert.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {alert.message}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => onDismissAlert(alert.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    fontSize: '16px',
                    lineHeight: 1,
                  }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Link */}
      {alerts.length > 5 && (
        <button
          className="btn-ghost"
          style={{ width: '100%', padding: '8px', fontSize: '12px' }}
        >
          View All Alerts ({alerts.length})
        </button>
      )}
    </div>
  )
}
