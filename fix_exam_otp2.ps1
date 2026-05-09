$file = 'D:\Assess Expert New\assessexpert\frontend\portal\app\exam\page.tsx'
$content = Get-Content $file -Raw

$old = "A 6-digit code has been sent to <strong>{email}</strong></p>`n          <form onSubmit={handleVerifyO"
$new = "A 6-digit code has been sent to <strong>{email}</strong></p>`n`n          {/* Dev mode OTP banner */}`n          {devOtp && (`n            <div style={{ padding: '12px 16px', background: 'rgba(215,119,6,0.12)', border: '1px solid rgba(215,119,6,0.4)', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>`n              <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--amber)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev Mode — OTP</p>`n              <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: 'var(--amber)', letterSpacing: '10px', fontFamily: 'monospace' }}>{devOtp}</p>`n              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>This banner only appears in development</p>`n            </div>`n          )}`n`n          <form onSubmit={handleVerifyO"
$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done. Has devOtp banner: $($content.Contains('Dev Mode — OTP'))"
