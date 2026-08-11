# Production P1 Hardening Implementation Plan

**Goal:** Complete the next production-readiness layer after P0 without changing product behavior or visual design.

## Scope

1. Scan every uploaded user-controlled file before parsing or persistence; fail closed in production.
2. Preserve backend request IDs through API failures and provide a recoverable global frontend error boundary.
3. Add browser-level smoke coverage for student, auditor, and administrator critical paths.
4. Enforce repeatable frontend bundle budgets in CI.
5. Expose actionable AI usage, failure, latency, and quota metrics using the existing AI call log.
6. Verify type safety, unit tests, builds, scripts, and migration state.

## Acceptance

- Infected uploads and unavailable required scanners are rejected before business services execute.
- API errors expose a request ID without leaking sensitive response data.
- Rendering failures show a platform-consistent recovery screen and can be retried.
- Critical role workflows have deterministic Playwright smoke tests.
- CI rejects material bundle regressions.
- Administrators can inspect AI volume, token use, failure rate, and latency by purpose/model.
- Existing quality gates remain green.
