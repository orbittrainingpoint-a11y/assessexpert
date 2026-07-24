import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    // Don't intercept auth endpoints — let them fail naturally
    if (original.url?.includes('/auth/login') ||
        original.url?.includes('/auth/refresh') ||
        original.url?.includes('/auth/otp') ||
        original.url?.includes('/auth/magic-link')) {
      return Promise.reject(error)
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          localStorage.setItem('accessToken', data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        }
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        // Only redirect if not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  verifyMfa: (userId: string, token: string) => api.post('/auth/mfa/verify', { userId, token }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  setupMfa: () => api.post('/auth/mfa/setup'),
  enableMfa: (token: string) => api.post('/auth/mfa/enable', { token }),
  sendOtp: (email: string, sessionToken: string) => api.post('/auth/otp/send', { email, sessionToken }),
  verifyOtp: (email: string, otp: string, sessionToken?: string) => api.post('/auth/otp/verify', { email, otp, sessionToken }),
  verifyMagicLink: (token: string) => api.post('/auth/magic-link/verify', { token }),
  // Public forgot-password. Server always returns 200 to avoid
  // leaking whether the email is registered.
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  // Public reset-password. Consumes the token from the emailed link
  // + new password. 400 on invalid/expired token.
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  // Public email verification — consumes the token from the emailed
  // link, sets emailVerifiedAt on the User.
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  // MFA backup code — alternative to TOTP when the user has lost
  // their authenticator device. Single-use.
  verifyMfaBackup: (userId: string, code: string) =>
    api.post('/auth/mfa/verify-backup', { userId, code }),
  // Authenticated — regenerate the 10 backup codes. Returns them
  // plaintext ONCE; old codes are invalidated.
  regenerateBackupCodes: () => api.post('/auth/mfa/backup-codes/regenerate'),
  // GDPR §7 — self-service data export (right to data portability).
  // Server sends application/json with Content-Disposition attachment.
  exportMyData: () => api.get('/auth/me/export', { responseType: 'blob' }),
  // GDPR §7 — self-delete. Soft delete + PII scrub. Refuses if the
  // caller is the last active SUPER_ADMIN.
  selfDelete: () => api.post('/auth/me/delete'),
}

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/dashboard/stats'),
  getActivity: (range: string, orgId?: string) => api.get(`/admin/dashboard/activity?range=${range}${orgId ? `&organizationId=${orgId}` : ''}`),
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key: string, value: any) => api.put(`/admin/settings/${key}`, { value }),
  getAuditLog: (filters?: any) => api.get('/admin/audit-log', { params: filters }),
  addReportComment: (id: string, comment: string, type: string) => api.post(`/admin/reports/${id}/comments`, { comment, type }),
}

// Organizations
export const orgsApi = {
  getAll: (filters?: any) => api.get('/organizations', { params: filters }),
  getOne: (id: string) => api.get(`/organizations/${id}`),
  create: (data: any) => api.post('/organizations', data),
  update: (id: string, data: any) => api.put(`/organizations/${id}`, data),
  suspend: (id: string, reason: string) => api.post(`/organizations/${id}/suspend`, { reason }),
  // Super-admin only — toggle a feature flag per org. Currently used for
  // the MCQ-only Quiz mode; same shape can fan out to other features.
  setQuizEnabled: (id: string, enabled: boolean) =>
    api.put(`/organizations/${id}/features/quiz`, { enabled }),
}

// Users
export const usersApi = {
  getAll: (filters?: any) => api.get('/users', { params: filters }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  invite: (data: any) => api.post('/users/invite', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
  // Flips INACTIVE → ACTIVE. Refuses if the user is DELETED.
  reactivate: (id: string) => api.post(`/users/${id}/reactivate`),
  // Soft delete — status → DELETED, row preserved for FK integrity.
  delete: (id: string) => api.delete(`/users/${id}`),
  // Admin-triggered: emails the user a 1-hour reset link.
  sendPasswordReset: (id: string) => api.post(`/users/${id}/send-password-reset`),
  suspend: (id: string, reason: string) => api.post(`/users/${id}/suspend`, { reason }),
  getProctors: () => api.get('/users/proctors'),
  getAvailability: (id: string) => api.get(`/users/${id}/availability`),
  sendDirectMessage: (proctorId: string, message: string) => api.post(`/users/${proctorId}/message`, { message }),
  sendProctorMessage: (sessionId: string, message: string) => api.post(`/sessions/${sessionId}/proctor-message`, { message }),
}

// Assessment Types
export const assessmentsApi = {
  getAll: (filters?: any) => api.get('/assessment-types', { params: filters }),
  getOne: (id: string) => api.get(`/assessment-types/${id}`),
  create: (data: any) => api.post('/assessment-types', data),
  update: (id: string, data: any) => api.put(`/assessment-types/${id}`, data),
  // DRAFT/ARCHIVED → ACTIVE. Required before HR can schedule
  // candidates against this assessment type.
  activate: (id: string) => api.post(`/assessment-types/${id}/activate`),
  // ACTIVE → ARCHIVED. Hides the type from HR scheduling without
  // deleting existing session data.
  archive: (id: string) => api.post(`/assessment-types/${id}/archive`),
}

// Questions
// Storage / uploads
export const storageApi = {
  uploadQuestionImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/storage/upload/question-asset', fd)
  },
}

// Returns the absolute URL for a backend-served upload path.
// Accepts: "/uploads/question-assets/123.png" or already-absolute URLs.
export function uploadUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '')
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

export const questionsApi = {
  getAll: (filters?: any) => api.get('/questions', { params: filters }),
  getOne: (id: string) => api.get(`/questions/${id}`),
  create: (data: any) => api.post('/questions', data),
  update: (id: string, data: any) => api.put(`/questions/${id}`, data),
  archive: (id: string) => api.post(`/questions/${id}/archive`),
  activate: (id: string) => api.post(`/questions/${id}/activate`),
  bulkActivate: (body: { ids?: string[]; assessmentTypeId?: string }) => api.post(`/questions/bulk-activate`, body),
  getPoolStats: (assessmentTypeId: string) => api.get(`/questions/pool-stats/${assessmentTypeId}`),
  bulkImport: (formData: FormData) => api.post('/questions/import', formData),
  // Download the CSV template a user can hand-edit before bulk import.
  // We hit the API with responseType:'blob' so the browser saves the
  // file rather than rendering it as text.
  downloadImportTemplate: () => api.get('/questions/import/template', { responseType: 'blob' }),
}

// Practical Paper Sets — new model with file library + typed questions
export const practicalSetsApi = {
  list: (assessmentTypeId?: string) =>
    api.get('/practical-sets', { params: assessmentTypeId ? { assessmentTypeId } : {} }),
  getOne: (id: string) => api.get(`/practical-sets/${id}`),
  create: (data: { assessmentTypeId: string; name: string; description?: string }) =>
    api.post('/practical-sets', data),
  update: (id: string, data: any) => api.put(`/practical-sets/${id}`, data),
  activate: (id: string) => api.post(`/practical-sets/${id}/activate`),
  delete: (id: string) => api.delete(`/practical-sets/${id}`),
  uploadFile: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/practical-sets/${id}/files`, fd)
  },
  deleteFile: (fileId: string) => api.delete(`/practical-sets/files/${fileId}`),
  createQuestion: (setId: string, data: any) =>
    api.post(`/practical-sets/${setId}/questions`, data),
  updateQuestion: (questionId: string, data: any) =>
    api.put(`/practical-sets/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) =>
    api.delete(`/practical-sets/questions/${questionId}`),
  reorder: (setId: string, orderedIds: string[]) =>
    api.post(`/practical-sets/${setId}/reorder`, { orderedIds }),
  assignToSession: (sessionId: string, setId: string, candidateId?: string) =>
    api.post(`/practical-sets/sessions/${sessionId}/assign`, { setId, candidateId }),
  getMyAssignedSet: (token: string, candidateId?: string) =>
    api.get(`/practical-sets/by-token`, { params: { token, ...(candidateId ? { candidateId } : {}) } }),
  submitAnswer: (token: string, questionId: string, payload: { numericValue?: number; textValue?: string; file?: File; candidateId?: string }) => {
    const fd = new FormData()
    if (payload.file) fd.append('file', payload.file)
    if (payload.numericValue !== undefined) fd.append('numericValue', String(payload.numericValue))
    if (payload.textValue !== undefined) fd.append('textValue', payload.textValue)
    if (payload.candidateId) fd.append('candidateId', payload.candidateId)
    return api.post(`/practical-sets/answer`, fd, {
      params: { token, questionId, ...(payload.candidateId ? { candidateId: payload.candidateId } : {}) },
    })
  },
  listAnswers: (sessionId: string, candidateId?: string) =>
    api.get(`/practical-sets/sessions/${sessionId}/answers`, {
      params: candidateId ? { candidateId } : {},
    }),
  gradeAnswer: (answerId: string, body: { marks?: number; graderNotes?: string }) =>
    api.put(`/practical-sets/answers/${answerId}/grade`, body),
}

// Practical Tasks
export const practicalTasksApi = {
  getAll: (filters?: any) => api.get('/practical-tasks', { params: filters }),
  getOne: (id: string) => api.get(`/practical-tasks/${id}`),
  create: (data: any) => api.post('/practical-tasks', data),
  update: (id: string, data: any) => api.put(`/practical-tasks/${id}`, data),
}

// Candidates
export const candidatesApi = {
  getAll: (filters?: any) => api.get('/candidates', { params: filters }),
  getOne: (id: string) => api.get(`/candidates/${id}`),
  create: (data: any) => api.post('/candidates', data),
  update: (id: string, data: any) => api.put(`/candidates/${id}`, data),
  delete: (id: string) => api.delete(`/candidates/${id}`),
  bulkImport: (formData: FormData) => api.post('/candidates/import', formData),
}

// Sessions
export const sessionsApi = {
  getAll: (filters?: any) => api.get('/sessions', { params: filters }),
  getOne: (id: string) => api.get(`/sessions/${id}`),
  getByToken: (token: string) => api.get(`/sessions/by-token/${token}`),
  create: (data: any) => api.post('/sessions', data),
  getToday: () => api.get('/sessions/today'),
  getLive: () => api.get('/sessions/live'),
  getStats: () => api.get('/sessions/stats'),
  getMasterProctorStats: () => api.get('/master-proctor/dashboard/stats'),
  begin: (id: string) => api.post(`/sessions/${id}/begin`),
  assignPractical: (id: string, practicalTaskId: string, candidateId?: string) =>
    api.post(`/sessions/${id}/assign-practical`, { practicalTaskId, candidateId }),
  // Master proctor reassigns a live session to a different proctor.
  // Kicks the previous proctor via the proctor.reassigned socket event.
  reassignProctor: (id: string, newProctorId: string, reason?: string) =>
    api.put(`/sessions/${id}/proctor`, { newProctorId, reason }),
  terminate: (id: string, reason: string) => api.post(`/sessions/${id}/terminate`, { reason }),
  pause: (id: string) => api.post(`/sessions/${id}/pause`),
  resume: (id: string) => api.post(`/sessions/${id}/resume`),
}

// Scheduling
export const schedulingApi = {
  getSlots: (assessmentTypeId: string, dateFrom: string, dateTo: string) =>
    api.get('/scheduling/slots', { params: { assessmentTypeId, dateFrom, dateTo } }),
  schedule: (data: any) => api.post('/scheduling/schedule', data),
  reschedule: (data: { sessionId: string; scheduledAt: string }) =>
    api.post('/scheduling/reschedule', data),
}

// Checklist — per-candidate. Pass candidateId on multi-candidate slots
// (single-candidate sessions fall back to the session's primary candidate).
export const checklistApi = {
  init: (sessionId: string, candidateId?: string) =>
    api.post(`/checklist/${sessionId}/init`, { candidateId }),
  get: (sessionId: string, candidateId?: string) =>
    api.get(`/checklist/${sessionId}`, { params: { candidateId } }),
  getAll: (sessionId: string) =>
    api.get(`/checklist/${sessionId}/all`),
  completeItem: (sessionId: string, itemKey: string, data: any) =>
    api.post(`/checklist/${sessionId}/items/${itemKey}/complete`, data),
  getTemplate: () => api.get('/checklist/template'),
}

// Facial recognition capture — proctor grabs a frame from the candidate
// stream and uploads it for storage + face detection. The backend persists
// the image and returns capturePath + faceDetected.
export const faceCaptureApi = {
  // candidateId is required for multi-candidate slots so the capture
  // and FR comparison land on the right SessionCandidate. Single-
  // candidate sessions can omit it and the backend resolves to the
  // session's primary candidate.
  captureIdVerification: (sessionId: string, imageBase64: string, checklistItemKey: string, candidateId?: string) =>
    api.post(`/mediapipe/capture/id-verification/${sessionId}`, {
      image: imageBase64,
      checklistItemKey,
      candidateId,
    }),
}

// Public legal content — Terms & Conditions and Privacy Policy, maintained
// by admins via /admin/settings. No auth required so candidates can see it
// on the OTP screen before they have a JWT.
export const legalApi = {
  getPublic: () => api.get('/legal/public'),
}

// Candidate uploads a one-time reference photo during the camera-check
// phase. Stored on CandidateRecord and used as the FR baseline.
export const referencePhotoApi = {
  status: (token: string, candidateId?: string) =>
    api.get('/exam/reference-photo/status', { params: { token, candidateId } }),
  upload: (token: string, candidateId: string | undefined, imageBase64: string) =>
    api.post(`/exam/reference-photo?token=${encodeURIComponent(token)}`, {
      candidateId,
      imageBase64,
    }),
}

// Pre-exam verification conversation transcript. Both sides append lines
// as they speak; the report viewer renders the result read-only.
export const transcriptApi = {
  // Proctor side — JWT-authenticated
  appendAsProctor: (sessionId: string, body: { candidateId?: string; text: string; timestamp?: string }) =>
    api.post(`/sessions/${sessionId}/transcript`, body),
  // Candidate side — magic-token auth
  appendAsCandidate: (token: string, body: { candidateId?: string; text: string; timestamp?: string }) =>
    api.post(`/exam/transcript?token=${encodeURIComponent(token)}`, body),
  // Read (proctor / HR / admin)
  get: (sessionId: string) => api.get(`/sessions/${sessionId}/transcript`),
}

// Reports — per-candidate. candidateId is optional; if omitted the backend
// falls back to the session's primary candidate (single-candidate flow).
export const reportsApi = {
  getAll: (filters?: any) => api.get('/reports', { params: filters }),
  getOne: (id: string) => api.get(`/reports/${id}`),
  getBySession: (sessionId: string, candidateId?: string) =>
    api.get(`/reports/session/${sessionId}`, { params: { candidateId } }),
  // List all reports (one per candidate) for a multi-candidate slot.
  listForSession: (sessionId: string) => api.get(`/reports/session/${sessionId}/list`),
  generate: (sessionId: string, opts?: { candidateId?: string; all?: boolean }) =>
    api.post(`/reports/generate/${sessionId}`, undefined, {
      params: { candidateId: opts?.candidateId, all: opts?.all ? 'true' : undefined },
    }),
  updateProctorFields: (sessionId: string, data: any & { candidateId?: string }) =>
    api.put(`/reports/session/${sessionId}/proctor-fields`, data),
  publish: (sessionId: string, candidateId?: string) =>
    api.post(`/reports/session/${sessionId}/publish`, candidateId ? { candidateId } : {}),
  rate: (sessionId: string, rating: number, note?: string, candidateId?: string) =>
    api.post(`/reports/session/${sessionId}/rate`, { rating, note, candidateId }),
  returnForModification: (id: string, instructions: string) =>
    api.post(`/reports/${id}/return`, { instructions }),
}

// Exam delivery (candidate)
// candidateId is required by the backend for multi-candidate slots (one
// MCQ question pool + answer bucket per candidate). Callers should pass
// the OTP-resolved candidateId from localStorage. For single-candidate
// sessions the backend falls back to the session's primary candidate.
const cidParam = (candidateId?: string) => candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ''

export const examApi = {
  getSession: (token: string, candidateId?: string) =>
    api.get(`/exam/session?token=${token}${cidParam(candidateId)}`),
  getCurrentQuestion: (token: string, candidateId?: string) =>
    api.get(`/exam/question/current?token=${token}${cidParam(candidateId)}`),
  submitAnswer: (token: string, questionId: string, response: any, timeSpentSeconds: number, candidateId?: string) =>
    api.post(`/exam/question/submit?token=${token}${cidParam(candidateId)}`, { questionId, response, timeSpentSeconds, candidateId }),
  getTimer: (token: string) => api.get(`/exam/timer?token=${token}`),
  getPracticalTask: (token: string, candidateId?: string) =>
    api.get(`/exam/practical/task?token=${token}${cidParam(candidateId)}`),
  submitPractical: (token: string, formData: FormData) =>
    api.post(`/exam/practical/submit?token=${token}`, formData),
  // Client-side "your timer just hit zero" notification. The candidate's
  // browser calls this when the visible countdown reaches 0 so the
  // backend records the auto-submit promptly — without it we used to
  // rely entirely on the 1-minute server-side cron, which left a
  // visible "exam complete" UI without any DB state for up to a minute.
  notifyTimerExpired: (token: string, phase: 'mcq' | 'practical', candidateId?: string) =>
    api.post(`/exam/timer/expired?token=${token}${cidParam(candidateId)}`, { phase, candidateId }),
}

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
}

// Proctoring
export const proctoringApi = {
  logEvent: (data: any) => api.post('/proctoring/events', data),
  getEvents: (sessionId: string) => api.get(`/proctoring/events/${sessionId}`),
  reviewFlag: (eventId: string, outcome: string, note: string) =>
    api.put(`/proctoring/events/${eventId}/review`, { outcome, note }),
  sendWarning: (sessionId: string, message: string) =>
    api.post(`/proctoring/sessions/${sessionId}/warn`, { message }),
}

// Recordings — multi-candidate aware. Optional candidateId resolves to
// that specific candidate's recording; omit for legacy single-candidate.
export const recordingsApi = {
  getUrl: (sessionId: string, candidateId?: string, streamType: 'screen' | 'webcam' = 'screen') =>
    api.get(`/recordings/sessions/${sessionId}/url`, { params: { candidateId, streamType } }),
  getStatus: (sessionId: string) => api.get(`/recordings/sessions/${sessionId}/status`),
}

// Sales
export const salesApi = {
  getStats: () => api.get('/sales/dashboard/stats'),
  getLeads: (filters?: any) => api.get('/sales/leads', { params: filters }),
  createLead: (data: any) => api.post('/sales/leads', data),
  updateLead: (id: string, data: any) => api.put(`/sales/leads/${id}`, data),
  getCompanies: () => api.get('/sales/companies'),
}

// TURN — Cloudflare-minted short-lived ICE servers. Public endpoint (works
// for both authenticated proctors and magic-token-only candidates).
export const turnApi = {
  getCredentials: () => api.get('/turn/credentials'),
}

// Quiz mode — MCQ-only exam, no camera/proctor. Token-gated public surface
// for the candidate flow; authenticated /reports surface for HR.
export const quizApi = {
  // Public (candidate)
  getByToken: (token: string) => api.get(`/quiz/public/by-token/${encodeURIComponent(token)}`),
  confirmEmail: (token: string, email: string) =>
    api.post(`/quiz/public/${encodeURIComponent(token)}/confirm-email`, { email }),
  sendOtp: (token: string) => api.post(`/quiz/public/${encodeURIComponent(token)}/send-otp`),
  verifyOtp: (token: string, otp: string) => api.post(`/quiz/public/${encodeURIComponent(token)}/verify-otp`, { otp }),
  getQuestions: (token: string) => api.get(`/quiz/public/${encodeURIComponent(token)}/questions`),
  submit: (token: string, answers: Array<{ questionId: string; selected: string[]; timeSpentSeconds?: number }>) =>
    api.post(`/quiz/public/${encodeURIComponent(token)}/submit`, { answers }),
  getReport: (token: string) => api.get(`/quiz/public/${encodeURIComponent(token)}/report`),
  // HR-only
  listReports: () => api.get('/quiz/reports'),
  getReportDetail: (reportId: string) => api.get(`/quiz/reports/${encodeURIComponent(reportId)}`),
  // Returns the rendered PDF as a Blob so the caller can trigger a
  // browser download via createObjectURL.
  getReportPdf: (reportId: string) =>
    api.get(`/quiz/reports/${encodeURIComponent(reportId)}/pdf`, { responseType: 'blob' }),
}

// Org branding — co-branded HR portal + candidate experience. Authenticated
// HR can read+update their own org's branding; the public endpoint lets
// candidate pages fetch by org id (the org id is returned alongside the
// magic-link lookup so we don't expose any guessable identifier).
export const brandingApi = {
  get: (orgId: string) => api.get(`/organizations/${orgId}/branding`),
  getPublic: (orgId: string) => api.get(`/organizations/public/${orgId}/branding`),
  update: (orgId: string, body: { logoUrl?: string | null; brandColor?: string | null; displayName?: string | null }) =>
    api.put(`/organizations/${orgId}/branding`, body),
}

// Interviews
export const interviewsApi = {
  schedule: (data: any) => api.post('/interviews/schedule', data),
  getAll: (filters?: any) => api.get('/interviews', { params: filters }),
  getOne: (id: string) => api.get(`/interviews/${id}`),
  start: (id: string) => api.post(`/interviews/${id}/start`),
  end: (id: string, body: any) => api.post(`/interviews/${id}/end`, body),
  cancel: (id: string) => api.post(`/interviews/${id}/cancel`),
  reschedule: (id: string, scheduledAt: string) =>
    api.post(`/interviews/${id}/reschedule`, { scheduledAt }),
  presence: () => api.get('/interviews/presence'),
  verifyFrame: (id: string, capturedImage: string) =>
    api.post(`/interviews/${id}/verify-frame`, { capturedImage }),
  manualVerify: (id: string, verified: boolean, note?: string) =>
    api.post(`/interviews/${id}/manual-verify`, { verified, note }),
  // Candidate-side magic-link lookup — public, no JWT required.
  getByToken: (token: string) => api.get(`/interviews/public/by-token/${encodeURIComponent(token)}`),
}
