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
  verifyOtp: (email: string, otp: string) => api.post('/auth/otp/verify', { email, otp }),
  verifyMagicLink: (token: string) => api.post('/auth/magic-link/verify', { token }),
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
}

// Users
export const usersApi = {
  getAll: (filters?: any) => api.get('/users', { params: filters }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
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
}

// Questions
export const questionsApi = {
  getAll: (filters?: any) => api.get('/questions', { params: filters }),
  getOne: (id: string) => api.get(`/questions/${id}`),
  create: (data: any) => api.post('/questions', data),
  update: (id: string, data: any) => api.put(`/questions/${id}`, data),
  archive: (id: string) => api.post(`/questions/${id}/archive`),
  getPoolStats: (assessmentTypeId: string) => api.get(`/questions/pool-stats/${assessmentTypeId}`),
  bulkImport: (formData: FormData) => api.post('/questions/import', formData),
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
  assignPractical: (id: string, practicalTaskId: string) => api.post(`/sessions/${id}/assign-practical`, { practicalTaskId }),
  terminate: (id: string, reason: string) => api.post(`/sessions/${id}/terminate`, { reason }),
  pause: (id: string) => api.post(`/sessions/${id}/pause`),
  resume: (id: string) => api.post(`/sessions/${id}/resume`),
}

// Scheduling
export const schedulingApi = {
  getSlots: (assessmentTypeId: string, dateFrom: string, dateTo: string) =>
    api.get('/scheduling/slots', { params: { assessmentTypeId, dateFrom, dateTo } }),
  schedule: (data: any) => api.post('/scheduling/schedule', data),
}

// Checklist
export const checklistApi = {
  init: (sessionId: string) => api.post(`/checklist/${sessionId}/init`),
  get: (sessionId: string) => api.get(`/checklist/${sessionId}`),
  completeItem: (sessionId: string, itemKey: string, data: any) =>
    api.post(`/checklist/${sessionId}/items/${itemKey}/complete`, data),
  getTemplate: () => api.get('/checklist/template'),
}

// Reports
export const reportsApi = {
  getAll: (filters?: any) => api.get('/reports', { params: filters }),
  getOne: (id: string) => api.get(`/reports/${id}`),
  getBySession: (sessionId: string) => api.get(`/reports/session/${sessionId}`),
  generate: (sessionId: string) => api.post(`/reports/generate/${sessionId}`),
  updateProctorFields: (sessionId: string, data: any) => api.put(`/reports/session/${sessionId}/proctor-fields`, data),
  publish: (sessionId: string, data?: any) => api.post(`/reports/session/${sessionId}/publish`, data || {}),
  rate: (sessionId: string, rating: number, note?: string) => api.post(`/reports/session/${sessionId}/rate`, { rating, note }),
  returnForModification: (id: string, instructions: string) => api.post(`/reports/${id}/return`, { instructions }),
}

// Exam delivery (candidate)
export const examApi = {
  getSession: (token: string) => api.get(`/exam/session?token=${token}`),
  getCurrentQuestion: (token: string) => api.get(`/exam/question/current?token=${token}`),
  submitAnswer: (token: string, questionId: string, response: any, timeSpentSeconds: number) =>
    api.post(`/exam/question/submit?token=${token}`, { questionId, response, timeSpentSeconds }),
  getTimer: (token: string) => api.get(`/exam/timer?token=${token}`),
  getPracticalTask: (token: string) => api.get(`/exam/practical/task?token=${token}`),
  submitPractical: (token: string, formData: FormData) =>
    api.post(`/exam/practical/submit?token=${token}`, formData),
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

// Recordings
export const recordingsApi = {
  getUrl: (sessionId: string) => api.get(`/recordings/sessions/${sessionId}/url`),
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

// Interviews
export const interviewsApi = {
  schedule: (data: any) => api.post('/interviews/schedule', data),
  getAll: (filters?: any) => api.get('/interviews', { params: filters }),
  getOne: (id: string) => api.get(`/interviews/${id}`),
  join: (id: string) => api.post(`/interviews/${id}/join`),
  end: (id: string, notes: any) => api.post(`/interviews/${id}/end`, notes),
}
