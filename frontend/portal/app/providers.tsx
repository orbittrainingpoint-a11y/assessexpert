'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>{children}</LocaleProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0D1526',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#F1F5F9' } },
          error: { iconTheme: { primary: '#E11D48', secondary: '#F1F5F9' } },
        }}
      />
    </QueryClientProvider>
  )
}
