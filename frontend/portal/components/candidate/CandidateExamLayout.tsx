'use client'

interface CandidateExamLayoutProps {
  candidateStream: MediaStream | null
}

export default function CandidateExamLayout({ candidateStream }: CandidateExamLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Centered Text */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <h1
          style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: '400',
            color: '#fff',
            letterSpacing: '0.05em',
          }}
        >
          Candidate Exam Screen After Starting Exam
        </h1>
      </div>

      {/* Hidden camera stream (continues streaming to proctor in background) */}
      {candidateStream && (
        <video
          ref={(el) => {
            if (el && candidateStream) {
              el.srcObject = candidateStream
              el.play().catch(() => {})
            }
          }}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
