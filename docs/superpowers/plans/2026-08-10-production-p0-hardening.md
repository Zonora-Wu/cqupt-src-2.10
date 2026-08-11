# Production P0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use diagnose and TDD for each failing quality gate.

**Goal:** Bring CQUPT-SRC from buildable internal beta to a repeatable, observable production candidate.

**Architecture:** Keep existing product behavior and domain boundaries. Make quality checks deterministic, replace auditor demo data with existing APIs, expose dependency-aware readiness, and add deployment verification plus backup/restore tooling without adding runtime dependencies.

**Tech Stack:** React 19, TypeScript, ESLint, NestJS 11, Prisma, PostgreSQL, Redis, MinIO, Docker Compose, Bash, GitHub Actions.

## Global Constraints

- Do not redesign pages or add unrelated features.
- Do not weaken Rules of Hooks, exhaustive dependency, or TypeScript safety checks.
- Environment-specific cloud checks must fail with actionable diagnostics and never print secrets.
- Backup tooling must create verified artifacts; restore tooling must require explicit confirmation.

---

### Task 1: Deterministic quality gate

**Files:**
- Modify: `frontend/eslint.config.js`
- Modify: frontend files reported by ESLint
- Create: `scripts/quality-gate.sh`

- [ ] Classify React 19 compiler diagnostics into valid framework exceptions and real defects.
- [ ] Fix conditional hooks, stale dependencies, declaration-order bugs, unused values, and Fast Refresh boundaries.
- [ ] Run frontend lint/build and backend typecheck/build/unit tests/Prisma validation from one command.

### Task 2: Auditor real-data completion

**Files:**
- Modify: `frontend/src/pages/auditor/AuditorHome.tsx`
- Modify/Create: dashboard service types and tests where required.

- [ ] Remove static vulnerability, retest, history, announcement, and AI-summary fixtures.
- [ ] Build dashboard and queue views from current dashboard/review/retest APIs.
- [ ] Preserve loading, empty, and failure states without falling back to fake records.

### Task 3: Backend test reliability

**Files:**
- Modify: `backend/test/ai-runtime-failover.test.ts`
- Modify: `backend/test/auth-password-reset.test.ts`
- Modify source only when a behavioral regression is proven.

- [ ] Reproduce each failure independently.
- [ ] Remove shared-process environment/global pollution and close runtime resources.
- [ ] Make all backend test files pass both independently and in the full suite.

### Task 4: CI enforcement

**Files:**
- Create: `.github/workflows/quality.yml`

- [ ] Install pinned frontend/backend dependencies with `npm ci`.
- [ ] Run the repository quality gate on pull requests and main pushes.
- [ ] Cache npm safely and upload concise logs on failure.

### Task 5: Readiness and deployment verification

**Files:**
- Modify: `backend/src/modules/health/*`
- Create: `deploy/scripts/verify-production.sh`
- Modify: `update-cqupt-test.sh`

- [ ] Add liveness and dependency-aware readiness checks for PostgreSQL, Redis, object storage, and configured AI endpoint.
- [ ] Verify public HTTP API, WebSocket upgrade, SMTP configuration, object storage, and AI endpoint without exposing credentials.
- [ ] Run verification automatically after service restart/update.

### Task 6: Backup, restore, and operational visibility

**Files:**
- Create: `deploy/scripts/backup-postgres.sh`
- Create: `deploy/scripts/verify-postgres-backup.sh`
- Create: `deploy/scripts/restore-postgres.sh`
- Create: `docs/deployment/PRODUCTION_RUNBOOK.md`

- [ ] Create timestamped compressed PostgreSQL backups with checksum and retention.
- [ ] Verify archive readability and document isolated restore rehearsal.
- [ ] Add structured request/error logging and health alert guidance using existing platform facilities.
- [ ] Document unresolved live-cloud checks as explicit acceptance items.

### Final verification

- [ ] `bash scripts/quality-gate.sh`
- [ ] `git diff --check`
- [ ] Confirm no mock vulnerability records remain in auditor production code.
- [ ] Confirm scripts pass `bash -n`.
- [ ] Record local results and mark Tencent Cloud-only checks as unconfirmed until run there.
