const fs = require('fs')
const file = 'D:\\Assess Expert New\\assessexpert\\frontend\\portal\\app\\(portal)\\proctor\\session\\page.tsx'
let t = fs.readFileSync(file, 'utf8')

// Fix 1: Find where candidateStream is referenced and add useWebRTC before it
const idx1 = t.indexOf('const candidateStream = remoteStreams')
if (idx1 >= 0) {
  console.log('candidateStream already exists at:', idx1)
} else {
  // Insert useWebRTC + candidateStream before the candidateTiles block
  const anchor = '  // Build candidate tiles for MonitorGrid'
  const insert = `  // WebRTC — get candidate remote stream
  const { remoteStreams } = useWebRTC({
    sessionId,
    role: 'PROCTOR',
    localStream: proctorStreamRef.current,
    socket: wsSocket,
    enabled: !!sessionId,
  })
  const candidateStream: MediaStream | null = remoteStreams.size > 0 ? (Array.from(remoteStreams.values())[0] as MediaStream) : null

  `
  t = t.replace(anchor, insert + anchor)
  console.log('Inserted useWebRTC before candidateTiles')
}

// Fix 2: Fix stream type in candidateTiles - cast to MediaStream | null
t = t.replace(
  'stream: candidateStream,',
  'stream: candidateStream as MediaStream | null,'
)

// Fix 3: Remove duplicate comment if any
t = t.replace(
  '  // WebRTC for candidate video feeds\n  // (declared after proctorStreamRef below)\n',
  ''
)

fs.writeFileSync(file, t, 'utf8')
console.log('Done')
