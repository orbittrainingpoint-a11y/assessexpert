#!/usr/bin/env node
// AssessExpert run/smoke driver.
//
// Boots the NestJS backend from its built dist/ and drives the live HTTP
// surface: Swagger up, real super-admin login → JWT, authenticated /me,
// and an unauthenticated 401. Optionally boots the Next.js frontend and
// checks that it serves the login + candidate-exam pages.
//
// This is the harness a future agent uses to confirm the app actually
// runs — not just that it type-checks. It assumes the local Postgres DB
// is up and migrated (see SKILL.md "Build"); it does NOT migrate for you,
// because that mutates the dev database and should be an explicit step.
//
// Usage (cwd = unit root `assessexpert/`, or anywhere — paths self-resolve):
//   node .claude/skills/run-assessexpert/driver.mjs            # backend smoke
//   node .claude/skills/run-assessexpert/driver.mjs --frontend # + frontend serve check
//   node .claude/skills/run-assessexpert/driver.mjs --no-build # skip nest build (dist must exist)
//   node .claude/skills/run-assessexpert/driver.mjs --keep     # leave servers running on success
//
// Env overrides: BACKEND_PORT (4000), FRONTEND_PORT (3000),
//                LOGIN_EMAIL / LOGIN_PASSWORD (demo super-admin defaults).

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const UNIT = resolve(SKILL_DIR, '..', '..', '..'); // unit/.claude/skills/run-assessexpert -> unit/
const BACKEND = resolve(UNIT, 'backend');
const FRONTEND = resolve(UNIT, 'frontend', 'portal');

const args = process.argv.slice(2);
const opt = (f) => args.includes(f);
const BACKEND_PORT = process.env.BACKEND_PORT || '4000';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';
const API = `http://localhost:${BACKEND_PORT}`;
const WEB = `http://localhost:${FRONTEND_PORT}`;
const EMAIL = process.env.LOGIN_EMAIL || 'admin@assessexpert.ae';
const PASSWORD = process.env.LOGIN_PASSWORD || 'Admin@assessexpert2026!';
const isWin = process.platform === 'win32';

const children = [];
let failed = false;
const log = (m) => console.log(m);
const ok = (m) => log(`  ✓ ${m}`);
const bad = (m) => { failed = true; log(`  ✗ ${m}`); };

function npmCmd(cwd, scriptArgs, label) {
  log(`\n[build] ${label} (${cwd})`);
  const r = spawnSync(isWin ? 'npm.cmd' : 'npm', scriptArgs, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) { bad(`${label} failed (exit ${r.status})`); process.exit(1); }
}

function startServer(name, cmd, cmdArgs, cwd, env) {
  log(`\n[boot] ${name}: ${cmd} ${cmdArgs.join(' ')}`);
  const child = spawn(cmd, cmdArgs, { cwd, env: { ...process.env, ...env }, shell: isWin });
  children.push(child);
  child.stdout.on('data', (d) => process.stdout.write(`  [${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`  [${name}] ${d}`));
  return child;
}

async function waitFor(url, label, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status > 0) { ok(`${label} responding (HTTP ${r.status}) after ~${i + 1}s`); return true; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  bad(`${label} did not respond within ${tries}s`);
  return false;
}

function stopAll() {
  for (const c of children) {
    try {
      if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/t', '/f'], { stdio: 'ignore' });
      else c.kill('SIGTERM');
    } catch { /* already gone */ }
  }
}

async function backendSmoke() {
  log('\n[smoke] backend HTTP surface');

  // 1. Swagger up (dev only — proves the app fully bootstrapped)
  try {
    const r = await fetch(`${API}/api/docs`);
    r.status === 200 ? ok(`GET /api/docs -> 200`) : bad(`GET /api/docs -> ${r.status}`);
  } catch (e) { bad(`GET /api/docs threw: ${e.message}`); }

  // 2. Real login -> JWT
  let token = null;
  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = await r.json().catch(() => ({}));
    token = body.accessToken;
    if (r.status === 200 && token) ok(`POST /api/auth/login -> 200 (JWT, role=${body.user?.role})`);
    else bad(`POST /api/auth/login -> ${r.status} (no token; is the DB seeded?)`);
  } catch (e) { bad(`login threw: ${e.message}`); }

  // 3. Authenticated /me with the token
  if (token) {
    try {
      const r = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const me = await r.json().catch(() => ({}));
      r.status === 200 && me.email ? ok(`GET /api/auth/me -> 200 (${me.email})`) : bad(`GET /api/auth/me -> ${r.status}`);
    } catch (e) { bad(`/me threw: ${e.message}`); }
  }

  // 4. Unauthenticated /me must be rejected
  try {
    const r = await fetch(`${API}/api/auth/me`);
    r.status === 401 ? ok(`GET /api/auth/me (no token) -> 401`) : bad(`GET /api/auth/me (no token) -> ${r.status} (expected 401)`);
  } catch (e) { bad(`unauth /me threw: ${e.message}`); }
}

async function frontendSmoke() {
  log('\n[smoke] frontend serve');
  try {
    const r = await fetch(`${WEB}/login`);
    const html = await r.text();
    if (r.status === 200 && /Sign In/i.test(html)) ok(`GET /login -> 200 (renders Sign In)`);
    else bad(`GET /login -> ${r.status} (Sign In marker ${/Sign In/i.test(html) ? 'found' : 'missing'})`);
  } catch (e) { bad(`/login threw: ${e.message}`); }
  try {
    const r = await fetch(`${WEB}/exam?token=DEMO-AHMED-2026-ACAD-L1-TOKEN`, { redirect: 'manual' });
    r.status === 200 ? ok(`GET /exam?token=... -> 200`) : bad(`GET /exam -> ${r.status}`);
  } catch (e) { bad(`/exam threw: ${e.message}`); }
}

async function main() {
  // Build backend unless told not to (or dist already present)
  const dist = resolve(BACKEND, 'dist', 'src', 'main.js');
  if (!opt('--no-build') || !existsSync(dist)) {
    npmCmd(BACKEND, ['run', 'build'], 'nest build');
  } else {
    ok('skipping backend build (--no-build, dist present)');
  }

  startServer('backend', isWin ? 'node' : 'node', ['dist/src/main'], BACKEND, { PORT: BACKEND_PORT });
  if (!(await waitFor(`${API}/api/docs`, 'backend'))) { stopAll(); process.exit(1); }
  await backendSmoke();

  if (opt('--frontend')) {
    // Frontend must already be built (npm run build) — we start the prod server.
    startServer('frontend', isWin ? 'npm.cmd' : 'npm', ['run', 'start'], FRONTEND, { PORT: FRONTEND_PORT });
    if (await waitFor(`${WEB}/login`, 'frontend')) await frontendSmoke();
  }

  log(failed ? '\n=== SMOKE FAILED ===' : '\n=== SMOKE PASSED ===');
  if (opt('--keep') && !failed) {
    log('--keep set: leaving servers running. Ctrl-C to stop.');
    return; // children stay alive; process holds open via their stdio listeners
  }
  stopAll();
  process.exit(failed ? 1 : 0);
}

process.on('SIGINT', () => { stopAll(); process.exit(130); });
main().catch((e) => { console.error(e); stopAll(); process.exit(1); });
