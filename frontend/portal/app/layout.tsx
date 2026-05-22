import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://assessexpert.ae'),
  title: {
    default: 'AssessExpert — AI-Proctored Pre-Employment Assessment Platform',
    template: '%s',
  },
  description:
    'AssessExpert delivers AI-proctored, proctor-controlled technical assessments with verified, human-reviewed reports across any industry or job role.',
  applicationName: 'AssessExpert',
  authors: [{ name: 'Orbit Training' }],
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
