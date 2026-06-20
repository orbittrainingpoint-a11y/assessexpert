'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi, assessmentsApi, schedulingApi, brandingApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Plus, Upload, Search, Calendar, ChevronRight, Download, CheckCircle, AlertCircle, X, Pencil, Trash2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const BLANK_FORM = { firstName: '', lastName: '', email: '', phone: '', jobPosition: '', yearsExperience: '0-1', department: '', notes: '', assessmentTypeId: '' }

// ── CSV Import Wizard ──────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5

function CsvImportWizard({ atList, onClose, onSuccess }: { atList: any[]; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<WizardStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<{ valid: any[]; errors: { row: number; field: string; message: string }[] } | null>(null)
  const [importAssessmentId, setImportAssessmentId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  const handleFileSelect = (f: File) => {
    setFile(f)
    // Client-side preview validation
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''))
      const valid: any[] = []
      const errors: { row: number; field: string; message: string }[] = []
      const seenEmails = new Set<string>()

      lines.slice(1).forEach((line, idx) => {
        const row = idx + 2
        const cols = line.split(',').map(c => c.trim().replace(/["']/g, ''))
        const obj: any = {}
        headers?.forEach((h, i) => { obj[h] = cols[i] || '' })

        const email = obj['email'] || obj['email address'] || ''
        const firstName = obj['first name'] || obj['firstname'] || ''
        const lastName = obj['last name'] || obj['lastname'] || ''

        if (!firstName) errors.push({ row, field: 'First Name', message: 'Missing first name' })
        if (!lastName) errors.push({ row, field: 'Last Name', message: 'Missing last name' })
        if (!email) errors.push({ row, field: 'Email', message: 'Missing email' })
        else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.push({ row, field: 'Email', message: `Invalid email: ${email}` })
        else if (seenEmails.has(email)) errors.push({ row, field: 'Email', message: `Duplicate email: ${email}` })
        else seenEmails.add(email)

        if (!errors.find(e => e.row === row)) valid.push({ firstName, lastName, email, phone: obj['phone'] || '', jobPosition: obj['job role'] || obj['jobrole'] || obj['position'] || '', yearsExperience: obj['experience'] || obj['years of experience'] || '0-1', notes: obj['notes'] || '' })
      })
      setValidation({ valid, errors })
      setStep(3)
    }
    reader.readAsText(f)
  }

  const handleDownloadTemplate = () => {
    const csv = 'First Name,Last Name,Email,Phone,Job Role,Experience (years),Notes\nAhmed,Al-Rashidi,ahmed@example.com,+971501234567,BIM Coordinator,3-5,'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'assessexpert_candidate_import_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadErrors = () => {
    if (!validation?.errors.length) return
    const csv = ['Row,Field,Error', ...validation.errors.map(e => `${e.row},${e.field},${e.message}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'import_errors.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleConfirmImport = async () => {
    if (!file || !importAssessmentId) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('assessmentTypeId', importAssessmentId)
    try {
      const { data: res } = await candidatesApi.bulkImport(fd)
      setImportResult({ success: res.success || validation?.valid.length || 0, failed: res.failed || validation?.errors.length || 0 })
      setStep(5)
      onSuccess()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Import failed')
    } finally { setImporting(false) }
  }

  const STEPS = ['Download Template', 'Upload File', 'Validation Report', 'Assign Assessment', 'Complete']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
      <div className="glass-card" style={{ width: '600px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Import Candidates</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: step > i + 1 ? 'var(--emerald)' : step === i + 1 ? 'var(--cyan)' : 'var(--bg-elevated)', color: step >= i + 1 ? '#fff' : 'var(--text-muted)' }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '10px', color: step === i + 1 ? 'var(--cyan)' : 'var(--text-muted)', textAlign: 'center', lineHeight: '1.2' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 1 — Download Template */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>Download the Import Template</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
              Use our template to ensure your data is formatted correctly. Fill in one row per candidate.
            </p>
            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
              <p style={{ margin: '0 0 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>Template columns:</p>
              <p style={{ margin: 0 }}>First Name · Last Name · Email · Phone · Job Role · Experience (years) · Notes</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" onClick={handleDownloadTemplate} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Download size={14} /> Download Template
              </button>
              <button className="btn-primary" onClick={() => setStep(2)} style={{ flex: 1 }}>I Have My File →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Upload File */}
        {step === 2 && (
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Upload Your File</h3>
            <div
              style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
              onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.xlsx,.xls'; i.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSelect(f) }; i.click() }}
            >
              <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>Drag and drop your file here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or click to browse · CSV, XLSX, XLS · Max 5MB · Max 500 rows</p>
            </div>
            <button className="btn-ghost" onClick={() => setStep(1)} style={{ marginTop: '16px', width: '100%' }}>← Back</button>
          </div>
        )}

        {/* Step 3 — Validation Report */}
        {step === 3 && validation && (
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Validation Report</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', background: 'rgba(5,150,105,0.08)', borderRadius: '8px', border: '1px solid rgba(5,150,105,0.2)', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--emerald)' }}>{validation.valid.length}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--emerald)' }}>✅ Valid candidates ready to import</p>
              </div>
              <div style={{ padding: '14px', background: validation.errors.length ? 'rgba(225,29,72,0.08)' : 'var(--bg-elevated)', borderRadius: '8px', border: `1px solid ${validation.errors.length ? 'rgba(225,29,72,0.2)' : 'var(--border)'}`, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: validation.errors.length ? 'var(--rose)' : 'var(--text-muted)' }}>{validation.errors.length}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: validation.errors.length ? 'var(--rose)' : 'var(--text-muted)' }}>{validation.errors.length ? '⚠️ Errors found' : '✓ No errors'}</p>
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--rose)' }}>Errors to review:</p>
                  <button className="btn-ghost" onClick={handleDownloadErrors} style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={11} /> Download Error Report
                  </button>
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {validation.errors.slice(0, 20).map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', padding: '6px 10px', background: 'rgba(225,29,72,0.06)', borderRadius: '6px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Row {e.row}</span>
                      <span style={{ color: 'var(--rose)' }}>{e.field}: {e.message}</span>
                    </div>
                  ))}
                  {validation.errors.length > 20 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>+{validation.errors.length - 20} more errors — download report</p>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setStep(2)} style={{ flex: 1 }}>← Re-upload</button>
              <button className="btn-primary" onClick={() => setStep(4)} disabled={!validation.valid.length} style={{ flex: 1, opacity: validation.valid.length ? 1 : 0.5 }}>
                Import {validation.valid.length} Valid Rows →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Assign Assessment */}
        {step === 4 && (
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Assign Assessment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Select which assessment to assign to all {validation?.valid.length} imported candidates. You can change individual candidates later.
            </p>
            <select className="form-input" value={importAssessmentId} onChange={e => setImportAssessmentId(e.target.value)} style={{ marginBottom: '20px' }}>
              <option value="">Select assessment...</option>
              {atList.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setStep(3)} style={{ flex: 1 }}>← Back</button>
              <button className="btn-primary" onClick={handleConfirmImport} disabled={!importAssessmentId || importing} style={{ flex: 1 }}>
                {importing ? 'Importing...' : `Confirm & Import ${validation?.valid.length} Candidates`}
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Complete */}
        {step === 5 && importResult && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={56} color="var(--emerald)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>Import Complete</h3>
            <p style={{ color: 'var(--emerald)', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>{importResult.success} candidates successfully added</p>
            {importResult.failed > 0 && <p style={{ color: 'var(--rose)', fontSize: '14px', marginBottom: '16px' }}>{importResult.failed} rows skipped due to errors</p>}
            <button className="btn-primary" onClick={onClose} style={{ marginTop: '20px', padding: '10px 32px' }}>View Candidates →</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CandidatesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  // Edit candidate modal state
  const [editCandidate, setEditCandidate] = useState<any>(null)
  const [editForm, setEditForm] = useState(BLANK_FORM)

  // Schedule modal state
  const [scheduleCandidate, setScheduleCandidate] = useState<any>(null)
  // When set, the schedule modal operates in "reschedule" mode against this session
  const [rescheduleSessionId, setRescheduleSessionId] = useState<string | null>(null)
  const [schedAssessmentId, setSchedAssessmentId] = useState('')
  const [schedDateFrom, setSchedDateFrom] = useState('')
  const [schedDateTo, setSchedDateTo] = useState('')
  const [schedTimePref, setSchedTimePref] = useState('MORNING')
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [slotsQueried, setSlotsQueried] = useState(false)
  // Slot length in minutes (default 1h). Candidates booked into the same
  // proctor + assessment within this window are auto-grouped into one slot.
  const [schedDuration, setSchedDuration] = useState(60)
  // Quiz mode = no camera, no proctor, MCQ-only. Defaults to PROCTORED
  // so existing scheduling behaviour is unchanged unless HR opts in.
  const [schedMode, setSchedMode] = useState<'PROCTORED' | 'QUIZ'>('PROCTORED')

  // Read org feature flags via branding so we can hide the Quiz mode
  // option when the platform admin hasn't enabled the feature for
  // this org. Same query key as the layout uses, so the result is
  // shared from React Query's cache — no duplicate fetch.
  const { user: authUser } = useAuthStore()
  const { data: brandingData } = useQuery({
    queryKey: ['branding', authUser?.organizationId],
    queryFn: () => brandingApi.get(authUser!.organizationId!).then(r => r.data),
    enabled: !!authUser?.organizationId,
    staleTime: 5 * 60 * 1000,
  })
  const quizFeatureEnabled = brandingData?.features?.quiz === true
  // If the platform admin disables Quiz while HR has the modal open
  // with QUIZ selected, reset to PROCTORED so the (now hidden) state
  // can't sneak past into the schedule mutation.
  useEffect(() => {
    if (!quizFeatureEnabled && schedMode === 'QUIZ') setSchedMode('PROCTORED')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizFeatureEnabled])

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', search],
    queryFn: () => candidatesApi.getAll({ search, limit: 50 }).then(r => r.data),
  })

  const { data: assessmentTypes } = useQuery({
    queryKey: ['assessment-types-list'],
    queryFn: () => assessmentsApi.getAll({ status: 'ACTIVE', limit: 100 }).then(r => r.data),
  })

  const { data: slotsData, refetch: fetchSlots, isFetching: loadingSlots } = useQuery({
    queryKey: ['scheduling-slots', schedAssessmentId, schedDateFrom, schedDateTo],
    queryFn: () => schedulingApi.getSlots(schedAssessmentId, schedDateFrom, schedDateTo).then(r => r.data),
    enabled: false,
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => candidatesApi.create(d),
    onSuccess: () => {
      toast.success('Candidate added')
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setShowAdd(false)
      setForm(BLANK_FORM)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: any }) => candidatesApi.update(id, d),
    onSuccess: () => {
      toast.success('Candidate updated')
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setEditCandidate(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update candidate'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      toast.success('Candidate deleted')
      qc.invalidateQueries({ queryKey: ['candidates'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete candidate'),
  })

  const scheduleMutation = useMutation({
    mutationFn: (d: any) =>
      rescheduleSessionId
        ? schedulingApi.reschedule({ sessionId: rescheduleSessionId, scheduledAt: d.scheduledAt })
        : schedulingApi.schedule(d),
    onSuccess: (res: any) => {
      // Backend now returns invitationSent / invitationError on the
      // scheduleSession response. Show the truth instead of always
      // claiming the email went out — silent SMTP failures were the
      // reason "schedule works second time only" was happening.
      const data = res?.data || {}
      const wasReschedule = !!rescheduleSessionId
      if (data.invitationSent === false) {
        toast.error(
          `${wasReschedule ? 'Rescheduled' : 'Scheduled'} but invitation email FAILED${data.invitationError ? ` — ${data.invitationError}` : ''}. Resend manually.`,
          { duration: 9000 },
        )
      } else {
        toast.success(
          wasReschedule
            ? 'Assessment rescheduled — updated invitation sent to candidate'
            : 'Assessment scheduled — invitation email sent to candidate',
        )
      }
      qc.invalidateQueries({ queryKey: ['candidates'] })
      closeScheduleModal()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to schedule'),
  })

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Legacy fallback — wizard is now primary
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data: res } = await candidatesApi.bulkImport(fd)
      toast.success(`Imported ${res.success} candidates`)
      qc.invalidateQueries({ queryKey: ['candidates'] })
    } catch { toast.error('Import failed') }
    e.target.value = ''
  }

  const openSchedule = (candidate: any) => {
    setScheduleCandidate(candidate)
    setRescheduleSessionId(null)
    setSchedAssessmentId(candidate.assessmentTypeId || candidate.sessions?.[0]?.assessmentTypeId || '')
    setSchedDateFrom('')
    setSchedDateTo('')
    setSelectedSlot(null)
    setSlotsQueried(false)
  }

  const openReschedule = (candidate: any) => {
    const sess = candidate.sessions?.find((s: any) => ['SCHEDULED', 'INVITED'].includes(s.status))
      || candidate.sessions?.[0]
      // Merged-into-a-slot candidate has no primary session — reschedule
      // against the slot they belong to.
      || candidate.sessionCandidates?.[0]?.session
    if (!sess) { toast.error('No scheduled session found to reschedule'); return }
    setScheduleCandidate(candidate)
    setRescheduleSessionId(sess.id)
    setSchedAssessmentId(sess.assessmentTypeId || candidate.assessmentTypeId || '')
    setSchedDateFrom('')
    setSchedDateTo('')
    setSelectedSlot(null)
    setSlotsQueried(false)
  }

  const closeScheduleModal = () => {
    setScheduleCandidate(null)
    setRescheduleSessionId(null)
    setSchedAssessmentId('')
    setSchedDateFrom('')
    setSchedDateTo('')
    setSelectedSlot(null)
    setSlotsQueried(false)
  }

  const openEdit = (candidate: any) => {
    setEditForm({
      firstName: candidate.firstName || '',
      lastName: candidate.lastName || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      jobPosition: candidate.jobPosition || '',
      yearsExperience: candidate.yearsExperience || '0-1',
      department: candidate.department || '',
      notes: candidate.notes || '',
      assessmentTypeId: candidate.assessmentTypeId || '',
    })
    setEditCandidate(candidate)
  }

  const handleDelete = (candidate: any) => {
    if (!window.confirm(`Delete ${candidate.firstName} ${candidate.lastName}? This cannot be undone.`)) return
    deleteMutation.mutate(candidate.id)
  }

  const handleFetchSlots = () => {
    if (!schedAssessmentId || !schedDateFrom || !schedDateTo) {
      toast.error('Select assessment type and date range first')
      return
    }
    setSlotsQueried(true)
    fetchSlots()
  }

  const handleConfirmSchedule = () => {
    if (!selectedSlot) { toast.error('Select a time slot'); return }
    scheduleMutation.mutate({
      candidateId: scheduleCandidate.id,
      assessmentTypeId: schedAssessmentId,
      scheduledAt: selectedSlot.datetime,
      slotDurationMinutes: schedDuration,
      mode: schedMode,
    })
  }

  const atList: any[] = assessmentTypes?.assessmentTypes || assessmentTypes || []
  const candidates: any[] = data?.candidates || []
  const slots: any[] = slotsData?.slots || slotsData || []
  const selectedAT = atList.find((a: any) => a.id === form.assessmentTypeId)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Candidates</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{data?.total ?? 0} total</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-ghost" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}>
              <Upload size={15} /> Import CSV
            </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Add Candidate
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '400px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Job Position</th><th>Assessment</th><th>Sessions</th><th>Latest Result</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !candidates.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No candidates yet. Add your first candidate.</td></tr>
            ) : candidates.map((c: any) => {
              const report = c.sessions?.[0]?.report
              // A candidate can be booked two ways: as a session's primary
              // candidate (c.sessions) OR merged into someone else's slot
              // (c.sessionCandidates → session). Count BOTH so a merged
              // candidate no longer shows "Not Scheduled" / a 2nd link.
              const slotSession = c.sessionCandidates?.[0]?.session
              const slotScheduled = slotSession && ['SCHEDULED', 'INVITED'].includes(slotSession.status)
              const hasScheduled = c.sessions?.some((s: any) => ['SCHEDULED', 'INVITED'].includes(s.status)) || slotScheduled
              const sessionCount = c.sessions?.length || (slotSession ? 1 : 0)
              return (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                    <Link href={`/hr/candidates/${c.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '500' }}>
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td style={{ fontSize: '13px' }}>{c.email}</td>
                  <td style={{ fontSize: '13px' }}>{c.jobPosition}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.assessmentType?.name || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{sessionCount}</td>
                  <td>
                    {report ? (
                      <span className={`badge ${report.overallPassed ? 'badge-pass' : 'badge-fail'}`}>
                        {report.overallPassed ? 'PASS' : 'FAIL'} · {report.overallScore?.toFixed(0)}%
                      </span>
                    ) : hasScheduled ? (
                      <span className="badge badge-pending">Scheduled</span>
                    ) : (
                      <span className="badge badge-draft">Not Scheduled</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {hasScheduled ? (
                        <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => openReschedule(c)} title="Reschedule assessment">
                          <RotateCcw size={12} /> Reschedule
                        </button>
                      ) : (
                        <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => openSchedule(c)} title="Schedule assessment">
                          <Calendar size={12} /> Schedule
                        </button>
                      )}
                      <button className="btn-ghost" style={{ padding: '6px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => openEdit(c)} title="Edit candidate">
                        <Pencil size={12} />
                      </button>
                      <button className="btn-ghost" style={{ padding: '6px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                        onClick={() => handleDelete(c)} title="Delete candidate" disabled={deleteMutation.isPending}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showImport && (
        <CsvImportWizard
          atList={atList}
          onClose={() => setShowImport(false)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['candidates'] }); setShowImport(false) }}
        />
      )}

      {/* ── ADD CANDIDATE MODAL ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '540px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Candidate</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>First Name *</label>
                  <input className="form-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Last Name *</label>
                  <input className="form-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Years of Experience</label>
                  <select className="form-input" value={form.yearsExperience} onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))}>
                    {['0-1', '1-3', '3-5', '5-10', '10+'].map(v => <option key={v} value={v}>{v} years</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Job Role Applied For *</label>
                <input className="form-input" value={form.jobPosition} onChange={e => setForm(f => ({ ...f, jobPosition: e.target.value }))} required placeholder="e.g. BIM Coordinator, CAD Draftsman" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment *</label>
                <select className="form-input" value={form.assessmentTypeId} onChange={e => setForm(f => ({ ...f, assessmentTypeId: e.target.value }))} required>
                  <option value="">Select assessment...</option>
                  {atList.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {selectedAT && (
                <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.06)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--cyan)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills Assessed</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(selectedAT.industryTags || [selectedAT.category]).map((tag: string) => (
                      <span key={tag} style={{ padding: '2px 8px', background: 'rgba(0,212,255,0.1)', borderRadius: '12px', fontSize: '11px', color: 'var(--cyan)' }}>{tag}</span>
                    ))}
                    <span style={{ padding: '2px 8px', background: 'rgba(0,212,255,0.1)', borderRadius: '12px', fontSize: '11px', color: 'var(--cyan)' }}>
                      {selectedAT.mcqCount || 25} MCQ · {selectedAT.mcqDuration || 30}min
                    </span>
                    {selectedAT.hasPractical && (
                      <span style={{ padding: '2px 8px', background: 'rgba(0,212,255,0.1)', borderRadius: '12px', fontSize: '11px', color: 'var(--cyan)' }}>
                        Practical · {selectedAT.practicalDuration || 60}min
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes (internal)</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Saving...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CANDIDATE MODAL ── */}
      {editCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '540px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Edit Candidate</h2>
            <form onSubmit={e => { e.preventDefault(); updateMutation.mutate({ id: editCandidate.id, data: editForm }) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>First Name *</label>
                  <input className="form-input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Last Name *</label>
                  <input className="form-input" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email *</label>
                <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone</label>
                  <input className="form-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Years of Experience</label>
                  <select className="form-input" value={editForm.yearsExperience} onChange={e => setEditForm(f => ({ ...f, yearsExperience: e.target.value }))}>
                    {['0-1', '1-3', '3-5', '5-10', '10+'].map(v => <option key={v} value={v}>{v} years</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Job Role Applied For *</label>
                <input className="form-input" value={editForm.jobPosition} onChange={e => setEditForm(f => ({ ...f, jobPosition: e.target.value }))} required placeholder="e.g. BIM Coordinator, CAD Draftsman" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Department</label>
                <input className="form-input" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes (internal)</label>
                <textarea className="form-input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditCandidate(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending} style={{ flex: 1 }}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SCHEDULE / RESCHEDULE MODAL ── */}
      {scheduleCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {rescheduleSessionId ? 'Reschedule Assessment' : 'Schedule Assessment'}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {scheduleCandidate.firstName} {scheduleCandidate.lastName} · {scheduleCandidate.email}
              {rescheduleSessionId && ' · picking a new slot will invalidate the old exam link'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment *</label>
                <select className="form-input" value={schedAssessmentId} onChange={e => { setSchedAssessmentId(e.target.value); setSelectedSlot(null); setSlotsQueried(false) }}>
                  <option value="">Select assessment...</option>
                  {atList.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Date From *</label>
                  <input className="form-input" type="date" value={schedDateFrom} onChange={e => { setSchedDateFrom(e.target.value); setSelectedSlot(null); setSlotsQueried(false) }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Date To *</label>
                  <input className="form-input" type="date" value={schedDateTo} onChange={e => { setSchedDateTo(e.target.value); setSelectedSlot(null); setSlotsQueried(false) }} />
                </div>
              </div>

              {!rescheduleSessionId && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Slot length <span style={{ color: 'var(--text-muted)' }}>· candidates booked in the same window share one slot</span>
                  </label>
                  <select className="form-input" value={schedDuration} onChange={e => setSchedDuration(Number(e.target.value))}>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour (default)</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              )}

              {!rescheduleSessionId && quizFeatureEnabled && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      ['PROCTORED', 'Proctored', 'Camera, ID check, live proctor — full assessment flow'],
                      ['QUIZ', 'Quiz only', 'MCQ only, no camera, candidate self-administers'],
                    ] as const).map(([val, label, desc]) => (
                      <button key={val} type="button"
                        onClick={() => setSchedMode(val as any)}
                        style={{
                          padding: '12px 14px', borderRadius: 8,
                          border: `1px solid ${schedMode === val ? 'var(--cyan)' : 'var(--border)'}`,
                          background: schedMode === val ? 'rgba(0,212,255,0.08)' : 'var(--bg-elevated)',
                          textAlign: 'left', cursor: 'pointer',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: schedMode === val ? 'var(--cyan)' : 'var(--text-primary)' }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Time Preference</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['MORNING', 'Morning (8am–12pm)'], ['AFTERNOON', 'Afternoon (12pm–5pm)'], ['EVENING', 'Evening (5pm–8pm)']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setSchedTimePref(v)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${schedTimePref === v ? 'var(--cyan)' : 'var(--border)'}`, background: schedTimePref === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: schedTimePref === v ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-ghost" onClick={handleFetchSlots} disabled={loadingSlots}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Calendar size={14} /> {loadingSlots ? 'Checking availability...' : 'Check Available Slots'}
              </button>

              {slotsQueried && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Available Slots {slots.length > 0 ? `(${slots.length} found)` : ''}
                  </p>
                  {!slots.length ? (
                    <div style={{ padding: '14px', background: 'rgba(215,119,6,0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--amber)' }}>
                      No available slots in this range. Try different dates.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {slots.map((slot: any, index: number) => (
                        <button key={slot.datetime || slot.id || index} type="button" onClick={() => setSelectedSlot(slot)}
                          style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${selectedSlot?.datetime === slot.datetime ? 'var(--cyan)' : 'var(--border)'}`, background: selectedSlot?.datetime === slot.datetime ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{new Date(slot.datetime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — {new Date(slot.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{slot.proctorCount || 0} proctor{slot.proctorCount !== 1 ? 's' : ''}</span>
                          {selectedSlot?.datetime === slot.datetime && <ChevronRight size={14} color="var(--cyan)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-ghost" onClick={closeScheduleModal} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmSchedule}
                disabled={!selectedSlot || scheduleMutation.isPending}
                style={{ flex: 1, opacity: selectedSlot ? 1 : 0.5 }}>
                {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm & Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
