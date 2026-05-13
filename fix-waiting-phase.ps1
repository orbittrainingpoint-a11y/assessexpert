$file = "d:\Assess Expert New\assessexpert\frontend\portal\app\exam\page.tsx"
$lines = Get-Content $file -Encoding UTF8
$before = $lines[0..744]
$after = $lines[874..($lines.Length-1)]
$newBlock = @(
  "  if (phase === 'waiting') return (",
  "    <CandidateVerificationLayout",
  "      sessionId={sessionState?.id || ''}",
  "      candidateId={sessionState?.candidate?.id || ''}",
  "      examTitle={sessionState?.assessmentType?.name || 'Assessment'}",
  "      proctorStream={proctorStream as MediaStream | null}",
  "      candidateStream={cameraStreamRef.current}",
  "      checklist={checklist}",
  "      proctorActive={proctorActive}",
  "    />",
  "  )"
)
$combined = $before + $newBlock + $after
Set-Content $file $combined -Encoding UTF8
Write-Host "Done. Lines: $($combined.Length)"
