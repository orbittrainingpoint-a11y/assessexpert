'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicalSetsApi, assessmentsApi, uploadUrl } from '@/lib/api'
import { Plus, ArrowLeft, Upload, X, FileText, CheckCircle2, Trash2, FileUp, Hash, Type as TypeIcon } from 'lucide-react'
import toast from 'react-hot-toast'

type AnswerType = 'FILE_UPLOAD' | 'NUMERIC' | 'TEXT'

const BLANK_Q: any = {
  prompt: '',
  answerType: 'FILE_UPLOAD' as AnswerType,
  marks: 1,
  rubric: '',
  referencedFileIds: [] as string[],
  // File
  acceptedFileTypes: '',
  maxFileSizeMB: 10,
  // Numeric
  expectedNumericAnswer: '',
  numericTolerance: '',
  numericUnit: '',
  numericMatchMode: 'TOLERANCE' as const,
  // Text
  expectedTextAnswer: '',
  textMatchMode: 'MANUAL' as const,
  textCaseSensitive: false,
}

export default function PaperSetsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ assessmentTypeId: '', name: '', description: '' })

  const { data: atData } = useQuery({
    queryKey: ['at-list-ps'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })
  const atList: any[] = atData?.assessmentTypes || atData || []
  const atWithPractical = atList.filter(at => at.practicalType && at.practicalType !== 'NONE')

  const { data: setsData, refetch: refetchSets } = useQuery({
    queryKey: ['paper-sets'],
    queryFn: () => practicalSetsApi.list().then(r => r.data),
  })
  const sets: any[] = setsData || []

  const createMutation = useMutation({
    mutationFn: (body: any) => practicalSetsApi.create(body),
    onSuccess: (r) => {
      toast.success('Paper set created')
      qc.invalidateQueries({ queryKey: ['paper-sets'] })
      setShowCreate(false)
      setCreateForm({ assessmentTypeId: '', name: '', description: '' })
      setActiveSetId(r.data.id)
      setView('editor')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  })

  if (view === 'editor' && activeSetId) {
    return <SetEditor setId={activeSetId} onBack={() => { setView('list'); setActiveSetId(null); refetchSets() }} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Practical Paper Sets</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Build numbered sets (Set 1, Set 2…) — each with its own file library and ordered questions. Proctor picks a set per candidate at exam time.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Paper Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No paper sets yet. Click "New Paper Set" to create your first one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {sets.map(s => (
            <div key={s.id} className="glass-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                <span className={`badge ${s.status === 'ACTIVE' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '10px' }}>{s.status}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {s.assessmentType?.name} · {s._count?.questions || 0} questions · {s._count?.files || 0} files
              </p>
              {s.description && <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.description}</p>}
              <button className="btn-primary" style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                onClick={() => { setActiveSetId(s.id); setView('editor') }}>
                Edit Set →
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '500px', padding: '24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>New Paper Set</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment *</label>
                <select className="form-input" value={createForm.assessmentTypeId} onChange={e => setCreateForm(f => ({ ...f, assessmentTypeId: e.target.value }))}>
                  <option value="">Select assessment with practical</option>
                  {atWithPractical.map(at => <option key={at.id} value={at.id}>{at.name} · {at.practicalType}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Set Name *</label>
                <input className="form-input" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Set 1" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description (optional)</label>
                <textarea className="form-input" rows={2} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Floor plan + section drawing" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }}
                disabled={!createForm.assessmentTypeId || !createForm.name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(createForm)}>
                {createMutation.isPending ? 'Creating...' : 'Create Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SET EDITOR ─────────────────────────────────────────────────────────

function SetEditor({ setId, onBack }: { setId: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { data: set, isLoading } = useQuery({
    queryKey: ['paper-set', setId],
    queryFn: () => practicalSetsApi.getOne(setId).then(r => r.data),
  })

  const [showAddQ, setShowAddQ] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [qForm, setQForm] = useState<any>(BLANK_Q)
  const [fileUploading, setFileUploading] = useState(false)

  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => practicalSetsApi.uploadFile(setId, file),
    onSuccess: () => { toast.success('File uploaded'); qc.invalidateQueries({ queryKey: ['paper-set', setId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Upload failed'),
  })
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => practicalSetsApi.deleteFile(fileId),
    onSuccess: () => { toast.success('File removed'); qc.invalidateQueries({ queryKey: ['paper-set', setId] }) },
  })
  const createQMutation = useMutation({
    mutationFn: (body: any) => practicalSetsApi.createQuestion(setId, body),
    onSuccess: () => {
      toast.success('Question added')
      qc.invalidateQueries({ queryKey: ['paper-set', setId] })
      setShowAddQ(false)
      setQForm(BLANK_Q)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })
  const updateQMutation = useMutation({
    mutationFn: ({ id, body }: any) => practicalSetsApi.updateQuestion(id, body),
    onSuccess: () => {
      toast.success('Question updated')
      qc.invalidateQueries({ queryKey: ['paper-set', setId] })
      setEditingQuestion(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })
  const deleteQMutation = useMutation({
    mutationFn: (id: string) => practicalSetsApi.deleteQuestion(id),
    onSuccess: () => { toast.success('Question deleted'); qc.invalidateQueries({ queryKey: ['paper-set', setId] }) },
  })
  const activateMutation = useMutation({
    mutationFn: () => practicalSetsApi.activate(setId),
    onSuccess: () => { toast.success('Set activated'); qc.invalidateQueries({ queryKey: ['paper-set', setId] }) },
  })

  const buildQuestionPayload = (form: any) => {
    const base: any = {
      prompt: form.prompt,
      answerType: form.answerType,
      marks: parseFloat(form.marks) || 1,
      rubric: form.rubric || undefined,
      referencedFileIds: form.referencedFileIds || [],
    }
    if (form.answerType === 'FILE_UPLOAD') {
      base.acceptedFileTypes = (form.acceptedFileTypes || '')
        .split(',').map((s: string) => s.trim()).filter(Boolean)
      base.maxFileSizeMB = parseInt(form.maxFileSizeMB) || undefined
    }
    if (form.answerType === 'NUMERIC') {
      base.expectedNumericAnswer = form.expectedNumericAnswer !== '' ? parseFloat(form.expectedNumericAnswer) : undefined
      base.numericTolerance = form.numericTolerance !== '' ? parseFloat(form.numericTolerance) : undefined
      base.numericUnit = form.numericUnit || undefined
      base.numericMatchMode = form.numericMatchMode || 'TOLERANCE'
    }
    if (form.answerType === 'TEXT') {
      base.expectedTextAnswer = form.expectedTextAnswer || undefined
      base.textMatchMode = form.textMatchMode || 'MANUAL'
      base.textCaseSensitive = !!form.textCaseSensitive
    }
    return base
  }

  if (isLoading || !set) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={13} /> Back to Paper Sets
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{set.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            {set.assessmentType?.name} · {set.questions?.length || 0} questions · {set.files?.length || 0} files · <span className={`badge ${set.status === 'ACTIVE' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '10px', marginLeft: '4px' }}>{set.status}</span>
          </p>
        </div>
        {set.status !== 'ACTIVE' && (
          <button className="btn-ghost" onClick={() => activateMutation.mutate()}
            style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--emerald)', borderColor: 'rgba(5,150,105,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} /> Activate Set
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* LEFT — Questions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Questions (in exam order)</h2>
            <button className="btn-primary" onClick={() => { setQForm(BLANK_Q); setShowAddQ(true) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px' }}>
              <Plus size={13} /> Add Question
            </button>
          </div>

          {(set.questions || []).length === 0 ? (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No questions yet. Add the first question for this set.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(set.questions || []).map((q: any) => (
                <div key={q.id} className="glass-card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--cyan)' }}>
                      Q{q.position}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-primary)' }}>{q.prompt}</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge badge-pending" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {q.answerType === 'FILE_UPLOAD' && <><FileUp size={10} /> File Upload</>}
                          {q.answerType === 'NUMERIC' && <><Hash size={10} /> Numeric</>}
                          {q.answerType === 'TEXT' && <><TypeIcon size={10} /> Text</>}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{q.marks} marks</span>
                        {q.fileRefs?.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            · Refers: {q.fileRefs.map((r: any) => r.file.fileName).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => {
                          setEditingQuestion(q)
                          setQForm({
                            prompt: q.prompt,
                            answerType: q.answerType,
                            marks: q.marks,
                            rubric: q.rubric || '',
                            referencedFileIds: q.fileRefs?.map((r: any) => r.fileId) || [],
                            acceptedFileTypes: (q.acceptedFileTypes || []).join(', '),
                            maxFileSizeMB: q.maxFileSizeMB || 10,
                            expectedNumericAnswer: q.expectedNumericAnswer ?? '',
                            numericTolerance: q.numericTolerance ?? '',
                            numericUnit: q.numericUnit || '',
                            numericMatchMode: q.numericMatchMode || 'TOLERANCE',
                            expectedTextAnswer: q.expectedTextAnswer || '',
                            textMatchMode: q.textMatchMode || 'MANUAL',
                            textCaseSensitive: !!q.textCaseSensitive,
                          })
                        }}>
                        Edit
                      </button>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                        onClick={() => { if (window.confirm('Delete this question?')) deleteQMutation.mutate(q.id) }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — File library */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>File Library</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', cursor: 'pointer', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <Upload size={13} />
              {fileUploading ? 'Uploading...' : 'Upload'}
              <input type="file" style={{ display: 'none' }} disabled={fileUploading}
                onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return
                  setFileUploading(true)
                  try { await uploadFileMutation.mutateAsync(f) } finally { setFileUploading(false); e.target.value = '' }
                }} />
            </label>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Files candidates can download. Questions can reference any of these by name.
          </p>
          {(set.files || []).length === 0 ? (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No files yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(set.files || []).map((f: any) => (
                <div key={f.id} className="glass-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="var(--cyan)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.fileName}>{f.fileName}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>{Math.round(f.fileSize / 1024)} KB</p>
                  </div>
                  <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--rose)' }}
                    onClick={() => { if (window.confirm(`Delete "${f.fileName}"?`)) deleteFileMutation.mutate(f.id) }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(showAddQ || editingQuestion) && (
        <QuestionModal
          form={qForm}
          setForm={setQForm}
          setFiles={set.files || []}
          editing={!!editingQuestion}
          saving={createQMutation.isPending || updateQMutation.isPending}
          onCancel={() => { setShowAddQ(false); setEditingQuestion(null) }}
          onSave={() => {
            const payload = buildQuestionPayload(qForm)
            if (editingQuestion) updateQMutation.mutate({ id: editingQuestion.id, body: payload })
            else createQMutation.mutate(payload)
          }}
        />
      )}
    </div>
  )
}

function QuestionModal({ form, setForm, setFiles, editing, saving, onCancel, onSave }: any) {
  const update = (patch: any) => setForm((f: any) => ({ ...f, ...patch }))
  const toggleFileRef = (fid: string) =>
    update({ referencedFileIds: form.referencedFileIds.includes(fid)
      ? form.referencedFileIds.filter((x: string) => x !== fid)
      : [...form.referencedFileIds, fid] })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      <div className="glass-card" style={{ width: '720px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>{editing ? 'Edit Question' : 'Add Question'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Question / Prompt *</label>
            <textarea className="form-input" rows={3} value={form.prompt} onChange={e => update({ prompt: e.target.value })} placeholder="What should the candidate do?" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Answer Type *</label>
              <select className="form-input" value={form.answerType} onChange={e => update({ answerType: e.target.value })}>
                <option value="FILE_UPLOAD">File Upload</option>
                <option value="NUMERIC">Numeric Value</option>
                <option value="TEXT">Text Input</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Marks</label>
              <input className="form-input" type="number" step="0.5" min="0" value={form.marks} onChange={e => update({ marks: e.target.value })} />
            </div>
          </div>

          {/* Type-specific fields */}
          {form.answerType === 'FILE_UPLOAD' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Accepted file types (comma-separated)</label>
                <input className="form-input" value={form.acceptedFileTypes} onChange={e => update({ acceptedFileTypes: e.target.value })} placeholder=".dwg, .pdf, .zip" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Max size (MB)</label>
                <input className="form-input" type="number" min="1" max="500" value={form.maxFileSizeMB} onChange={e => update({ maxFileSizeMB: e.target.value })} />
              </div>
            </div>
          )}

          {form.answerType === 'NUMERIC' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Expected value</label>
                <input className="form-input" type="number" step="any" value={form.expectedNumericAnswer} onChange={e => update({ expectedNumericAnswer: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>± Tolerance</label>
                <input className="form-input" type="number" step="any" value={form.numericTolerance} onChange={e => update({ numericTolerance: e.target.value })} placeholder="0.5" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Unit</label>
                <input className="form-input" value={form.numericUnit} onChange={e => update({ numericUnit: e.target.value })} placeholder="mm" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Match mode</label>
                <select className="form-input" value={form.numericMatchMode} onChange={e => update({ numericMatchMode: e.target.value })}>
                  <option value="TOLERANCE">± Tolerance</option>
                  <option value="EXACT">Exact</option>
                </select>
              </div>
            </div>
          )}

          {form.answerType === 'TEXT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Expected answer (for auto-grading)</label>
                <input className="form-input" value={form.expectedTextAnswer} onChange={e => update({ expectedTextAnswer: e.target.value })} placeholder="Leave blank for manual grading" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Match mode</label>
                <select className="form-input" value={form.textMatchMode} onChange={e => update({ textMatchMode: e.target.value })}>
                  <option value="MANUAL">Manual only</option>
                  <option value="EXACT">Exact match</option>
                  <option value="CONTAINS">Contains</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.textCaseSensitive} onChange={e => update({ textCaseSensitive: e.target.checked })} /> Case sensitive
                </label>
              </div>
            </div>
          )}

          {/* Referenced files */}
          {setFiles.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Referenced files (shown to candidate as downloads)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                {setFiles.map((f: any) => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.referencedFileIds.includes(f.id)} onChange={() => toggleFileRef(f.id)} />
                    <FileText size={13} color="var(--cyan)" />
                    {f.fileName}
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{Math.round(f.fileSize / 1024)} KB</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Rubric / grader notes (optional)</label>
            <textarea className="form-input" rows={2} value={form.rubric} onChange={e => update({ rubric: e.target.value })} placeholder="What the grader should look for" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1 }}
            disabled={!form.prompt.trim() || saving}
            onClick={onSave}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  )
}
