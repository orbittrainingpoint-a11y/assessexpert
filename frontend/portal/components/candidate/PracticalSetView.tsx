'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicalSetsApi, uploadUrl } from '@/lib/api'
import { FileText, Download, Upload, Check, Hash, Type as TypeIcon, FileUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  token: string
  sessionId: string
  candidateId?: string
  onAllSubmitted?: () => void
  socket?: any
}

interface SetFileView {
  id: string
  fileName: string
  fileSize?: number
  mimeType?: string
  downloadUrl?: string
}

interface PracticalQuestionView {
  id: string
  position: number
  prompt: string
  answerType: 'FILE_UPLOAD' | 'NUMERIC' | 'TEXT'
  marks: number
  acceptedFileTypes?: string[]
  maxFileSizeMB?: number
  numericUnit?: string
  referencedFiles: SetFileView[]
}

interface AssignedSet {
  id: string
  name: string
  description?: string
  files: SetFileView[]
  questions: PracticalQuestionView[]
  assessmentType?: { name: string }
}

export default function PracticalSetView({ token, sessionId, candidateId, onAllSubmitted, socket }: Props) {
  const qc = useQueryClient()
  const { data: set, isLoading, refetch } = useQuery<AssignedSet | null>({
    queryKey: ['my-practical-set', token, candidateId],
    queryFn: () => practicalSetsApi.getMyAssignedSet(token, candidateId).then(r => r.data as any),
    refetchInterval: 5000, // keep polling until a set is assigned
  })

  // When the proctor pushes a set via socket, refetch immediately
  useEffect(() => {
    if (!socket) return
    const handler = () => refetch()
    socket.on('practical.setAssigned', handler)
    return () => { socket.off('practical.setAssigned', handler) }
  }, [socket, refetch])

  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  // Notify parent once everything is submitted
  useEffect(() => {
    if (!set?.questions?.length) return
    if (set.questions.every(q => submittedIds.has(q.id))) {
      onAllSubmitted?.()
    }
  }, [submittedIds, set, onAllSubmitted])

  if (isLoading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading practical questions...</div>

  if (!set) {
    return (
      <div style={{ maxWidth: '560px', margin: '40px auto', padding: '32px', textAlign: 'center' }} className="glass-card">
        <FileText size={36} color="var(--cyan)" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Waiting for proctor to assign your practical set...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Stay on this screen. The questions will appear automatically.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 24px 40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          {set.assessmentType?.name} — Practical Assessment
        </p>
        <h1 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{set.name}</h1>
        {set.description && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{set.description}</p>}
      </div>

      {/* Set file library (always-available reference files) */}
      {set.files.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 18px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Reference files for this set
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {set.files.map(f => (
              <FileChip key={f.id} file={f} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {set.questions.map(q => (
          <QuestionCard
            key={q.id}
            q={q}
            token={token}
            candidateId={candidateId}
            submitted={submittedIds.has(q.id)}
            onSubmitted={() => {
              setSubmittedIds(prev => new Set(prev).add(q.id))
              qc.invalidateQueries({ queryKey: ['my-practical-set', token, candidateId] })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function FileChip({ file }: { file: SetFileView }) {
  const href = uploadUrl(file.downloadUrl || '')
  return (
    <a
      href={href}
      download={file.fileName}
      target="_blank"
      rel="noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)', textDecoration: 'none' }}
    >
      <FileText size={13} color="var(--cyan)" />
      <span>{file.fileName}</span>
      {file.fileSize ? <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({Math.round(file.fileSize / 1024)} KB)</span> : null}
      <Download size={12} color="var(--text-muted)" />
    </a>
  )
}

function QuestionCard({ q, token, candidateId, submitted, onSubmitted }: { q: PracticalQuestionView; token: string; candidateId?: string; submitted: boolean; onSubmitted: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [numericValue, setNumericValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitMutation = useMutation({
    mutationFn: () => practicalSetsApi.submitAnswer(token, q.id, {
      file: file || undefined,
      numericValue: numericValue !== '' ? parseFloat(numericValue) : undefined,
      textValue: textValue || undefined,
      candidateId,
    }),
    onSuccess: () => {
      toast.success(`Q${q.position} submitted`)
      onSubmitted()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Submit failed'),
    onSettled: () => setSubmitting(false),
  })

  const canSubmit =
    (q.answerType === 'FILE_UPLOAD' && !!file) ||
    (q.answerType === 'NUMERIC' && numericValue !== '' && !Number.isNaN(parseFloat(numericValue))) ||
    (q.answerType === 'TEXT' && textValue.trim().length > 0)

  const handleSubmit = () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    submitMutation.mutate()
  }

  return (
    <div className="glass-card" style={{ padding: '18px', borderLeft: submitted ? '3px solid var(--emerald)' : '3px solid var(--cyan)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, color: 'var(--cyan)' }}>
          Q{q.position}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>{q.prompt}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {q.answerType === 'FILE_UPLOAD' && <><FileUp size={10} /> Upload a file</>}
              {q.answerType === 'NUMERIC' && <><Hash size={10} /> Numeric answer{q.numericUnit ? ` (${q.numericUnit})` : ''}</>}
              {q.answerType === 'TEXT' && <><TypeIcon size={10} /> Text answer</>}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{q.marks} marks</span>
          </div>
        </div>
        {submitted && (
          <span style={{ color: 'var(--emerald)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <Check size={14} /> Submitted
          </span>
        )}
      </div>

      {/* Referenced files for this question */}
      {q.referencedFiles.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Refer to:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {q.referencedFiles.map(f => (
              <FileChip key={f.id} file={f} />
            ))}
          </div>
        </div>
      )}

      {/* Answer input by type */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px' }}>
        {q.answerType === 'FILE_UPLOAD' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px dashed var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Upload size={14} />
              {file ? file.name : `Upload file${q.acceptedFileTypes?.length ? ` (${q.acceptedFileTypes.join(', ')})` : ''}${q.maxFileSizeMB ? ` · max ${q.maxFileSizeMB} MB` : ''}`}
              <input type="file"
                accept={q.acceptedFileTypes?.length ? q.acceptedFileTypes.join(',') : undefined}
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        )}
        {q.answerType === 'NUMERIC' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              step="any"
              className="form-input"
              value={numericValue}
              onChange={e => setNumericValue(e.target.value)}
              placeholder={`Enter numeric value${q.numericUnit ? ` in ${q.numericUnit}` : ''}`}
              style={{ flex: 1 }}
            />
            {q.numericUnit && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{q.numericUnit}</span>}
          </div>
        )}
        {q.answerType === 'TEXT' && (
          <textarea
            className="form-input"
            rows={3}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder="Type your answer..."
            style={{ resize: 'vertical' }}
          />
        )}
        <button
          className="btn-primary"
          disabled={!canSubmit || submitting || submitted}
          onClick={handleSubmit}
          style={{ marginTop: '10px', padding: '8px 16px', fontSize: '13px', opacity: submitted ? 0.5 : 1 }}
        >
          {submitted ? '✓ Submitted' : submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>
    </div>
  )
}
