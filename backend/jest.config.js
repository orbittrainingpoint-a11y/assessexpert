/**
 * Jest config for AssessExpert backend.
 *
 * - Unit tests live next to source as `*.spec.ts` (skip the DB).
 * - Integration tests live under `test/integration/` as `*.int-spec.ts`
 *   and hit the live dev Postgres + Prisma client.
 *
 * Run modes:
 *   npm run test            — unit tests only (fast, no DB)
 *   npm run test:int        — integration tests only (needs DB up)
 *   npm run test:all        — everything
 *   npm run test:coverage   — unit tests + coverage report
 */
module.exports = {
  rootDir: '.',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.int-spec.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/diagnostics.ts',
    '!src/test-smtp.ts',
  ],
  coverageDirectory: 'coverage',
  // Reasonable defaults for a backend with a real DB available in CI/dev.
  testTimeout: 15_000,
  // Integration tests share a single test org by slug; running suites
  // in parallel races their setup/teardown. Force serial.
  maxWorkers: 1,
  // Quiet teardown of ts-jest's worker so the run exits cleanly.
  forceExit: true,
  // Show clear test names + failure context.
  verbose: false,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { sourceMap: false } }],
  },
}
