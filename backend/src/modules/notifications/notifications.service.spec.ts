import { htmlToPlainText } from './notifications.service';

/**
 * The htmlToPlainText helper is the multipart/alternative text/plain
 * fallback for every transactional email. Spam filters (Gmail's
 * especially) penalise HTML-only mail, so the text we send here is
 * the deliverability lever. These tests pin its behaviour.
 */
describe('htmlToPlainText', () => {
  it('strips script and style blocks completely', () => {
    const out = htmlToPlainText('Hello <script>alert(1)</script> world <style>.a{color:red}</style>');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('color:red');
    expect(out).toBe('Hello world');
  });

  it('preserves anchor href so candidates on text-only clients can use the link', () => {
    const out = htmlToPlainText('<a href="https://assessexpert.com/exam?token=abc">Join exam</a>');
    expect(out).toBe('Join exam (https://assessexpert.com/exam?token=abc)');
  });

  it('decodes common HTML entities our templates produce', () => {
    const out = htmlToPlainText('Tom &amp; Jerry &lt;3 &quot;quote&quot; it&#39;s &nbsp; spaced');
    expect(out).toBe('Tom & Jerry <3 "quote" it\'s spaced');
  });

  it('converts block-level closing tags to newlines', () => {
    const out = htmlToPlainText('<p>One</p><p>Two</p><div>Three</div>');
    expect(out).toContain('One\n');
    expect(out).toContain('Two\n');
    expect(out).toContain('Three');
  });

  it('keeps line breaks from <br/>', () => {
    const out = htmlToPlainText('Line 1<br/>Line 2<br>Line 3');
    expect(out.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('collapses repeated whitespace but preserves paragraph breaks', () => {
    const out = htmlToPlainText('<p>One</p><p></p><p></p><p></p><p>Two</p>');
    // Should not have 5 newlines between One and Two — collapsed to max 2.
    expect(out).not.toMatch(/\n{3,}/);
  });

  it('handles realistic invitation template without losing the link', () => {
    const html = `
      <div>
        <h1>Welcome</h1>
        <p>Hi Jane,</p>
        <p><strong>TestCo</strong> has scheduled your interview.</p>
        <a href="https://assessexpert.com/interview/abc123">Join Interview</a>
      </div>`;
    const out = htmlToPlainText(html);
    expect(out).toContain('Welcome');
    expect(out).toContain('Hi Jane,');
    expect(out).toContain('TestCo');
    expect(out).toContain('Join Interview (https://assessexpert.com/interview/abc123)');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });

  it('handles strings with no HTML', () => {
    expect(htmlToPlainText('Just plain text')).toBe('Just plain text');
  });
});
