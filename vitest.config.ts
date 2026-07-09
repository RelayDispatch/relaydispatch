// vitest.config.ts
// ─────────────────────────────────────────────────────────────────────────────
// RelayDispatch — Vitest Configuration
//
// Coverage provider: @vitest/coverage-v8 (Node.js native V8 coverage, zero
// instrumentation overhead, no Babel/Istanbul required).
//
// Thresholds are intentionally set to reflect the current baseline rather than
// aspirational targets. They will be tightened in future milestones as coverage
// of the API route layer and Temporal workflow runtime is added.
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially within each file but files run in parallel workers
    globals: false,
    environment: 'node',
    // Pool of threads — each worker gets its own isolated module registry
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    // Test file discovery
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '_archive/**',
    ],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Include only source files (not tests, not dist)
      include: [
        'apps/api/src/**/*.ts',
        'apps/worker/src/**/*.ts',
        'apps/scheduler/src/**/*.ts',
        'packages/*/src/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__mocks__/**',
      ],
      // Measured baseline (2026-07-10) using v8 provider:
      //   statements: 9.64%  — v8 only counts statements in files loaded during tests
      //   branches:   50.43% — strong: security/AI conditional paths are well-tested
      //   functions:  26.08% — reasonable: core dispatch, redactor, HMAC covered
      //   lines:      9.64%  — same as statements for v8
      //
      // The low statement/line % reflects that large parts of apps/api/ and
      // apps/worker/ are not imported during the current test suite.
      // Target for v1.2.0: statements ≥40%, branches ≥60%, functions ≥40%
      thresholds: {
        statements: 8,
        branches: 45,
        functions: 20,
        lines: 8,
      },
    },
    // Timeout: integration tests include a 1-second realistic delay
    testTimeout: 15000,
    // Environment variables available to all tests
    env: {
      NODE_ENV: 'test',
    },
  },
});
