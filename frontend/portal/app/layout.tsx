import type { Metadata } from 'next'
import { Inter, Outfit, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-body' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800', '900'],
})

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

// Self-heal stale chunk loads. After every deploy Turbopack regenerates
// .next/static/chunks with new content-hashes, so anyone holding an OLD
// HTML page in memory tries to fetch chunk filenames that no longer
// exist — a 404 cascade and ChunkLoadError. The handler below catches
// that and reloads ONCE (sessionStorage-gated so a truly broken deploy
// can't infinite-loop the browser). Runs inline before any other JS so
// it's attached before the first lazy import.
const CHUNK_RELOAD_GUARD = `(function(){
  var KEY='__ae_chunk_reload__';
  function isChunkErr(m){return !!m&&/ChunkLoadError|Loading chunk|Failed to load chunk|Loading CSS chunk/i.test(m);}
  function reloadOnce(){
    try{
      var now=Date.now();
      var prev=Number(sessionStorage.getItem(KEY)||0);
      if(now-prev<30000)return;  // already reloaded recently — don't loop
      sessionStorage.setItem(KEY,String(now));
    }catch(e){}
    location.reload();
  }
  window.addEventListener('error',function(e){
    var m=(e&&e.message)||(e&&e.error&&e.error.message);
    if(isChunkErr(m))reloadOnce();
  });
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason;var m=r?(r.message||String(r)):'';
    if(isChunkErr(m))reloadOnce();
  });
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RELOAD_GUARD }} />
      </head>
      <body className={`${inter.variable} ${outfit.variable} ${playfair.variable} ${inter.className}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
