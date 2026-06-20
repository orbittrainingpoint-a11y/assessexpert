import { AuditLogInterceptor } from './audit-log.interceptor';

/**
 * Unit test for the redact/truncate logic used by the audit log
 * interceptor. The `scrub` method is private; we reach it via `as any`
 * because it's pure data-shape transformation and worth covering
 * directly — the redact list is the only thing standing between
 * sensitive payloads and the AuditLog DB rows.
 */
describe('AuditLogInterceptor.scrub', () => {
  let interceptor: AuditLogInterceptor;

  beforeEach(() => {
    // PrismaService isn't touched by scrub() — pass an empty stub.
    interceptor = new AuditLogInterceptor({} as any);
  });

  it('redacts password fields', () => {
    const out = (interceptor as any).scrub({ email: 'a@b.com', password: 'super-secret' });
    expect(out).toEqual({ email: 'a@b.com', password: '[REDACTED]' });
  });

  it('redacts every variant of password + OTP + token fields', () => {
    const input = {
      email: 'a@b.com',
      password: 'p1',
      newPassword: 'p2',
      currentPassword: 'p3',
      confirm: 'p4',
      otp: '123456',
      code: 'abc',
      token: 't',
      magicToken: 'mt',
      refreshToken: 'rt',
    };
    const out = (interceptor as any).scrub(input);
    expect(out.email).toBe('a@b.com');
    for (const k of ['password', 'newPassword', 'currentPassword', 'confirm', 'otp', 'code', 'token', 'magicToken', 'refreshToken']) {
      expect(out[k]).toBe('[REDACTED]');
    }
  });

  it('redacts base64-style fields (captured images, logos)', () => {
    const out = (interceptor as any).scrub({
      capturedImage: 'data:image/jpeg;base64,/9j/AAA...',
      imageBase64: 'AAA...',
      base64: 'AAA...',
      logoUrl: 'data:image/png;base64,AAA...',
    });
    expect(out.capturedImage).toBe('[REDACTED]');
    expect(out.imageBase64).toBe('[REDACTED]');
    expect(out.base64).toBe('[REDACTED]');
    expect(out.logoUrl).toBe('[REDACTED]');
  });

  it('truncates long strings (likely base64 leaking through a field we did not list)', () => {
    const long = 'A'.repeat(2000);
    const out = (interceptor as any).scrub({ notes: long });
    expect(out.notes.length).toBeLessThan(220);
    expect(out.notes).toContain('[truncated]');
  });

  it('recursively scrubs nested objects', () => {
    const out = (interceptor as any).scrub({
      candidate: { email: 'c@x.com', password: 'p' },
    });
    expect(out.candidate.email).toBe('c@x.com');
    expect(out.candidate.password).toBe('[REDACTED]');
  });

  it('recursively scrubs arrays', () => {
    const out = (interceptor as any).scrub({
      users: [{ email: 'a@b.com', password: 'x' }, { email: 'b@c.com', password: 'y' }],
    });
    expect(out.users[0].password).toBe('[REDACTED]');
    expect(out.users[1].password).toBe('[REDACTED]');
    expect(out.users[0].email).toBe('a@b.com');
  });

  it('returns null for null/undefined inputs', () => {
    expect((interceptor as any).scrub(null)).toBeNull();
    expect((interceptor as any).scrub(undefined)).toBeNull();
  });

  it('leaves non-object values alone', () => {
    expect((interceptor as any).scrub('hello')).toBe('hello');
    expect((interceptor as any).scrub(42)).toBe(42);
  });
});
