import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strip console.log / .debug / .info / .warn from the PRODUCTION build.
  // console.error is kept so real crashes still land in the browser console
  // AND get captured by Sentry.captureException wiring (providers.tsx).
  //
  // Why: 48 stray console.* calls sit across the portal — many log objects
  // with tokens, session ids, or candidate PII. Anyone hitting F12 in
  // production could scrape them. See docs/PORTAL_GAPS.md item C5.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },
};

export default nextConfig;
