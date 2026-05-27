// CMS admin API — wraps the shared axios instance (JWT from localStorage)
// against the role-guarded /cms/admin/* backend routes.
import { api } from './api'

export interface CmsPageRow {
  slug: string
  title: string
  status: 'DRAFT' | 'PUBLISHED'
  content: Record<string, unknown>
  metaTitle?: string | null
  metaDescription?: string | null
  ogImage?: string | null
  keywords: string[]
  updatedAt?: string
}

export interface CmsPostRow {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body: string
  coverImage?: string | null
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED'
  authorName?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  keywords: string[]
  publishedAt?: string | null
  updatedAt?: string
}

export interface CmsMediaRow {
  id: string
  url: string
  filename: string
  mimeType: string
  size: number
  alt?: string | null
  createdAt: string
}

export const cmsApi = {
  // Pages
  listPages: () => api.get<CmsPageRow[]>('/cms/admin/pages').then((r) => r.data),
  getPage: (slug: string) => api.get<CmsPageRow>(`/cms/admin/pages/${slug}`).then((r) => r.data),
  savePage: (slug: string, body: Partial<CmsPageRow>) => api.put<CmsPageRow>(`/cms/admin/pages/${slug}`, body).then((r) => r.data),

  // Posts
  listPosts: () => api.get<CmsPostRow[]>('/cms/admin/posts').then((r) => r.data),
  getPost: (id: string) => api.get<CmsPostRow>(`/cms/admin/posts/${id}`).then((r) => r.data),
  createPost: (body: Partial<CmsPostRow>) => api.post<CmsPostRow>('/cms/admin/posts', body).then((r) => r.data),
  updatePost: (id: string, body: Partial<CmsPostRow>) => api.put<CmsPostRow>(`/cms/admin/posts/${id}`, body).then((r) => r.data),
  deletePost: (id: string) => api.delete(`/cms/admin/posts/${id}`).then((r) => r.data),

  // Media
  listMedia: () => api.get<CmsMediaRow[]>('/cms/admin/media').then((r) => r.data),
  uploadMedia: (file: File, alt?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (alt) fd.append('alt', alt)
    return api.post<CmsMediaRow>('/cms/admin/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  deleteMedia: (id: string) => api.delete(`/cms/admin/media/${id}`).then((r) => r.data),
}

export const CMS_ROLES = ['CMS_ADMIN', 'CMS_EDITOR', 'SUPER_ADMIN']

export function cmsErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : fallback
}
