import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Render an assessment report to PDF via Puppeteer.
 *
 * Caches the rendered file at `${STORAGE_PATH}/reports/${reportId}.pdf` and
 * re-uses it on subsequent requests as long as `Report.pdfVersion` hasn't
 * been bumped. Bumping the version invalidates the cache and forces a
 * fresh render — call invalidate() whenever the report content changes
 * (e.g. on publish, on proctor narrative edit).
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly storagePath = process.env.STORAGE_PATH || './storage';

  constructor(private prisma: PrismaService) {}

  private reportsDir() {
    const dir = path.join(this.storagePath, 'reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  // Bump pdfVersion so the next read regenerates. Cheap; doesn't touch the file.
  async invalidate(reportId: string) {
    try {
      await this.prisma.report.update({
        where: { id: reportId },
        data: { pdfVersion: { increment: 1 }, pdfPath: null },
      });
    } catch (e) {
      // If the row doesn't exist yet, nothing to invalidate.
    }
  }

  // Returns the absolute path to a rendered PDF for the report, generating
  // it on demand if missing or stale.
  async getOrGeneratePdf(sessionId: string): Promise<string> {
    const report = await this.prisma.report.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: {
            candidate: true,
            assessmentType: true,
            organization: true,
            events: { orderBy: { timestamp: 'asc' } },
            frLogs: { orderBy: { timestamp: 'desc' }, take: 5 },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found for this session');

    const expectedFile = path.join(this.reportsDir(), `${report.id}-v${report.pdfVersion ?? 0}.pdf`);
    if (report.pdfPath && fs.existsSync(report.pdfPath) && path.resolve(report.pdfPath) === path.resolve(expectedFile)) {
      return report.pdfPath;
    }

    const html = this.buildHtml(report);
    const pdfPath = await this.renderToFile(html, expectedFile);
    await this.prisma.report.update({
      where: { id: report.id },
      data: { pdfPath, pdfVersion: report.pdfVersion ?? 1 },
    });
    return pdfPath;
  }

  // ─── PDF rendering ──────────────────────────────────────────────────────
  private async renderToFile(html: string, outPath: string): Promise<string> {
    // Lazy-load puppeteer so the rest of the app still boots if puppeteer's
    // bundled Chromium failed to download on a fresh install. The error then
    // surfaces only when someone tries to generate a PDF.
    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer');
    } catch (e: any) {
      this.logger.error('puppeteer not available: ' + (e?.message || e));
      throw new Error('PDF generation is not available: puppeteer failed to load. Run `npm install` on the server.');
    }

    const launchOptions: any = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };
    // Allow a system Chrome/Chromium binary to be used instead of the
    // bundled one (useful on VPS where the bundled download failed).
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: outPath,
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;color:#94A3B8;width:100%;padding:0 15mm;display:flex;justify-content:space-between"><span>AssessExpert · Assessment Report</span><span class="date"></span></div>`,
        footerTemplate: `<div style="font-size:9px;color:#94A3B8;width:100%;padding:0 15mm;display:flex;justify-content:space-between"><span>Generated <span class="date"></span></span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
    } finally {
      await browser.close().catch(() => {});
    }
    return outPath;
  }

  // ─── HTML template ──────────────────────────────────────────────────────
  private buildHtml(report: any): string {
    const session = report.session || {};
    const candidate = session.candidate || {};
    const assessment = session.assessmentType || {};
    const org = session.organization || {};
    const events: any[] = session.events || [];
    const critical = events.filter(e => e.severity === 'CRITICAL').length;
    const warnings = events.filter(e => e.severity === 'WARNING').length;
    const frLog = (session.frLogs || [])[0];
    const transcript = (session.verificationTranscript as any)?.lines || [];

    const mcqScore = report.mcqScore ?? 0;
    const mcqTotal = assessment.mcqQuestionCount ?? 25;
    const passClass = report.overallPassed ? 'pass' : 'fail';
    const verdictLabel = String(report.proctorVerdict || 'PENDING').replaceAll('_', ' ');
    const integrityScore = typeof report.integrityScore === 'number' ? report.integrityScore : 100;
    const integrityClass = integrityScore >= 90 ? 'pass' : integrityScore >= 70 ? 'warn' : 'fail';

    const transcriptHtml = transcript.length
      ? `<div class="card"><h2>Verification Conversation</h2>
          <div class="transcript">
            ${transcript.slice(0, 50).map((l: any) => `
              <div class="line ${l.speaker === 'PROCTOR' ? 'proctor' : 'candidate'}">
                <span class="speaker">${l.speaker}</span>
                <span class="text">${this.escape(l.text || '')}</span>
              </div>`).join('')}
            ${transcript.length > 50 ? `<div class="muted">… ${transcript.length - 50} more lines truncated.</div>` : ''}
          </div>
        </div>`
      : '';

    return `<!doctype html><html><head><meta charset="utf-8" />
<title>Assessment Report — ${this.escape(candidate.firstName || '')} ${this.escape(candidate.lastName || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; color: #0F172A; margin: 0; padding: 0; line-height: 1.55; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #0F172A; }
  h2 { font-size: 14px; margin: 0 0 10px; color: #0F172A; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .brand { font-size: 16px; font-weight: 700; color: #00B5D8; letter-spacing: 0.5px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge.pass { background: #D1FAE5; color: #047857; }
  .badge.fail { background: #FEE2E2; color: #B91C1C; }
  .badge.warn { background: #FEF3C7; color: #92400E; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 16px; }
  .meta-grid div { font-size: 11px; }
  .meta-grid b { color: #475569; font-weight: 600; }
  .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
  .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  .score-tile { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; }
  .score-value { font-size: 22px; font-weight: 700; }
  .score-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .pass { color: #047857; }
  .fail { color: #B91C1C; }
  .warn { color: #B45309; }
  .narrative { white-space: pre-wrap; font-size: 12px; color: #1E293B; line-height: 1.6; }
  .muted { color: #94A3B8; font-size: 11px; font-style: italic; }
  .fr-photo { display: flex; gap: 14px; align-items: center; }
  .fr-photo img { width: 90px; height: 90px; border-radius: 6px; object-fit: cover; border: 1px solid #E2E8F0; }
  .transcript { display: flex; flex-direction: column; gap: 4px; }
  .line { padding: 4px 8px; border-radius: 4px; background: #F8FAFC; font-size: 11px; }
  .line.proctor { border-left: 3px solid #00B5D8; }
  .line.candidate { border-left: 3px solid #10B981; }
  .line .speaker { display: inline-block; font-weight: 700; color: #64748B; font-size: 9px; text-transform: uppercase; margin-right: 6px; }
  .integrity-row { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
  .integrity-bar { flex: 1; height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden; }
  .integrity-fill { height: 100%; background: #00B5D8; }
  .footer-note { margin-top: 18px; font-size: 9px; color: #94A3B8; text-align: center; line-height: 1.5; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">assessexpert</div>
      <h1>${this.escape(candidate.firstName || '')} ${this.escape(candidate.lastName || '')}</h1>
      <div style="font-size:11px;color:#64748B">${this.escape(assessment.name || '')} &middot; ${this.escape(org.name || '')}</div>
    </div>
    <div>
      <span class="badge ${passClass}">${report.overallPassed ? 'PASS' : 'FAIL'}</span>
    </div>
  </div>

  <div class="meta-grid">
    <div><b>Email:</b> ${this.escape(candidate.email || '')}</div>
    <div><b>Position:</b> ${this.escape(candidate.jobPosition || '—')}</div>
    <div><b>Scheduled:</b> ${session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : '—'}</div>
    <div><b>Published:</b> ${report.publishedAt ? new Date(report.publishedAt).toLocaleString() : 'Draft'}</div>
    <div><b>Proctor Verdict:</b> ${this.escape(verdictLabel)}</div>
    <div><b>Practical Quality:</b> ${this.escape(String(report.practicalQuality || '—').replaceAll('_', ' '))}</div>
  </div>

  <div class="scores">
    <div class="score-tile">
      <div class="score-value ${passClass}">${mcqScore.toFixed ? mcqScore.toFixed(0) : mcqScore}/${mcqTotal}</div>
      <div class="score-label">MCQ Score</div>
    </div>
    <div class="score-tile">
      <div class="score-value ${passClass}">${(report.overallScore ?? mcqScore).toFixed ? (report.overallScore ?? mcqScore).toFixed(0) : 0}%</div>
      <div class="score-label">Overall</div>
    </div>
    <div class="score-tile">
      <div class="score-value ${integrityClass}">${integrityScore.toFixed ? integrityScore.toFixed(0) : integrityScore}/100</div>
      <div class="score-label">Integrity</div>
    </div>
  </div>

  ${report.aiNarrative ? `<div class="card"><h2>AI Summary</h2><div class="narrative">${this.escape(report.aiNarrative)}</div></div>` : ''}

  ${report.proctorNarrative ? `<div class="card"><h2>Proctor Narrative</h2><div class="narrative">${this.escape(report.proctorNarrative)}</div></div>` : ''}

  <div class="card">
    <h2>Integrity Events</h2>
    <div class="integrity-row">
      <div class="integrity-bar"><div class="integrity-fill" style="width:${integrityScore}%"></div></div>
      <div style="font-size:11px;color:#64748B">${integrityScore.toFixed ? integrityScore.toFixed(0) : integrityScore}/100</div>
    </div>
    <div style="font-size:11px;color:#1E293B">
      <b style="color:#B91C1C">${critical}</b> critical &middot;
      <b style="color:#B45309">${warnings}</b> warning &middot;
      <b style="color:#0F172A">${events.length}</b> total
    </div>
  </div>

  ${frLog ? `<div class="card"><h2>Facial Recognition</h2>
    <div class="fr-photo">
      <div>
        <div><b>Outcome:</b> <span class="${frLog.outcome === 'VERIFIED' ? 'pass' : frLog.outcome === 'PENDING_REVIEW' ? 'warn' : 'fail'}">${frLog.outcome}</span></div>
        <div><b>Similarity:</b> ${(frLog.similarityScore ?? 0).toFixed(1)}%</div>
        <div><b>Captured:</b> ${new Date(frLog.timestamp).toLocaleString()}</div>
      </div>
    </div>
  </div>` : ''}

  ${transcriptHtml}

  <div class="footer-note">
    This document was generated automatically by assessexpert.<br/>
    Report status: ${this.escape(String(report.status || 'DRAFT'))} · Version ${report.pdfVersion ?? 1}<br/>
    Property of ${this.escape(org.name || 'the organization')}. Do not distribute.
  </div>
</body></html>`;
  }

  private escape(s: any): string {
    if (s === null || s === undefined) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
