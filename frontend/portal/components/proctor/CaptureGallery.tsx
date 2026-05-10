'use client'
import { useState, useEffect } from 'react'
import { Camera, Download, Maximize2, X } from 'lucide-react'
import { api } from '@/lib/api'

interface CaptureImage {
  id: string
  sessionId: string
  imageUrl: string
  thumbnailUrl: string
  captureType: 'ID_VERIFICATION' | 'PERIODIC' | 'EVENT_TRIGGERED' | 'MANUAL'
  triggerReason?: string
  timestamp: Date
  metadata?: any
}

interface CaptureGalleryProps {
  sessionId: string
  enabled?: boolean
}

export default function CaptureGallery({ sessionId, enabled = true }: CaptureGalleryProps) {
  const [captures, setCaptures] = useState<CaptureImage[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<CaptureImage | null>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (!enabled || !sessionId) return

    const fetchCaptures = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/mediapipe/captures/${sessionId}`)
        setCaptures(data.captures || [])
      } catch (err) {
        console.error('Failed to fetch captures:', err)
      } finally {
        setLoading(false)
      }
    }

    const fetchStats = async () => {
      try {
        const { data } = await api.get(`/mediapipe/capture-stats?sessionId=${sessionId}`)
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }

    fetchCaptures()
    fetchStats()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchCaptures()
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [sessionId, enabled])

  const getCaptureTypeLabel = (type: CaptureImage['captureType']) => {
    switch (type) {
      case 'ID_VERIFICATION': return 'ID Verification'
      case 'PERIODIC': return 'Periodic'
      case 'EVENT_TRIGGERED': return 'Event Triggered'
      case 'MANUAL': return 'Manual'
    }
  }

  const getCaptureTypeColor = (type: CaptureImage['captureType']) => {
    switch (type) {
      case 'ID_VERIFICATION': return 'var(--cyan)'
      case 'PERIODIC': return 'var(--emerald)'
      case 'EVENT_TRIGGERED': return 'var(--amber)'
      case 'MANUAL': return 'var(--purple)'
    }
  }

  const handleDownload = async (capture: CaptureImage) => {
    try {
      const response = await fetch(capture.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `capture-${capture.id}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  if (loading && captures.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Camera size={18} style={{ color: 'var(--cyan)' }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Capture Gallery</h3>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading captures...
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="glass-card" style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} style={{ color: 'var(--cyan)' }} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Capture Gallery</h3>
          </div>
          {stats && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {stats.totalCaptures} captures
            </span>
          )}
        </div>

        {/* Stats Summary */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
            <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>ID Verification</p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '600', color: 'var(--cyan)' }}>{stats.idVerificationCount || 0}</p>
            </div>
            <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Periodic</p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '600', color: 'var(--emerald)' }}>{stats.periodicCount || 0}</p>
            </div>
            <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Event Triggered</p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '600', color: 'var(--amber)' }}>{stats.eventTriggeredCount || 0}</p>
            </div>
            <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Manual</p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '600', color: 'var(--purple)' }}>{stats.manualCount || 0}</p>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {captures.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
            No captures yet
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {captures.map(capture => (
              <div
                key={capture.id}
                style={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setSelectedImage(capture)}
              >
                <img
                  src={capture.thumbnailUrl || capture.imageUrl}
                  alt={`Capture ${capture.id}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                  padding: '4px 6px',
                }}>
                  <div style={{
                    fontSize: '8px',
                    fontWeight: '600',
                    color: getCaptureTypeColor(capture.captureType),
                    textTransform: 'uppercase',
                  }}>
                    {getCaptureTypeLabel(capture.captureType)}
                  </div>
                  <div style={{ fontSize: '8px', color: '#fff', marginTop: '2px' }}>
                    {new Date(capture.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {getCaptureTypeLabel(selectedImage.captureType)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {new Date(selectedImage.timestamp).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-ghost"
                  onClick={() => handleDownload(selectedImage)}
                  style={{ padding: '8px' }}
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setSelectedImage(null)}
                  style={{ padding: '8px' }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Image */}
            <div style={{ padding: '16px', maxHeight: 'calc(90vh - 120px)', overflow: 'auto' }}>
              <img
                src={selectedImage.imageUrl}
                alt={`Capture ${selectedImage.id}`}
                style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
              />
            </div>

            {/* Metadata */}
            {selectedImage.triggerReason && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trigger Reason</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {selectedImage.triggerReason}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
