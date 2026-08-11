# AI Knowledge Reuse Refactor

**Goal:** Make the AI knowledge base an independent, governed conversation-reuse system that improves answer accuracy and reduces model token use. Knowledge must never create, update, draft, publish, or install a Skill.

## Product Boundary

- Source: reusable, user-confirmed resolved AI conversations.
- Output: reviewed structured knowledge entries only.
- Runtime: direct answer for high-confidence matches; bounded context injection for medium-confidence matches; normal model call for low-confidence matches.
- Governance: redaction, safety checks, manual review, constrained auto-approval, feedback degradation, revisions, rollback, maintenance, and audit.
- Explicit exclusion: no Knowledge -> Skill conversion in UI, API, service, worker, or automatic lifecycle.

## Implementation Checklist

### 1. Remove Knowledge -> Skill paths

- [x] Remove Skill lifecycle invocation after manual knowledge approval.
- [x] Remove Skill lifecycle invocation after automatic knowledge approval.
- [x] Remove `SKILL_CANDIDATE` from problem-session review actions.
- [x] Remove knowledge-derived Skill Candidate endpoints from the knowledge controller.
- [x] Remove knowledge-derived Skill controls, types, and service calls from the admin knowledge UI.
- [x] Keep the independent declarative Skill management and review modules unchanged.

### 2. Consolidate the capture pipeline

- [x] Keep `AiProblemSession` as the only production conversation capture path.
- [x] Stop registering the legacy capture worker.
- [x] Remove legacy capture/conversation controls from the admin workspace.
- [x] Preserve old database rows for migration/audit; do not silently delete them.
- [x] Convert legacy `SKILL_CANDIDATE` problem sessions back to `READY_REVIEW`.

### 3. Complete knowledge governance

- [x] Add an admin knowledge detail/editor dialog.
- [x] Edit title, canonical question/answer, category, tags, role scope, sensitivity, visibility, and retrieval policy.
- [x] Require a change reason and create an immutable revision.
- [x] List versions and support audited rollback.
- [x] Surface source, status, scores, hit/feedback counts, and maintenance state.

### 4. Feedback degradation

- [x] A first unhelpful vote disables direct answer immediately.
- [x] Abuse reports disable retrieval and agent injection immediately.
- [x] Create a deduplicated maintenance task for degraded knowledge.
- [x] Preserve new-session rule: any downvote/report blocks auto-approval.
- [x] Require administrator remediation before restoring stronger routes.

### 5. Retrieval and token policy

- [x] Keep deterministic role/sensitivity/status filtering before ranking.
- [x] Direct answer only above the high-confidence threshold.
- [x] Inject at most three medium-confidence entries with bounded content.
- [x] Do not inject low-confidence entries.
- [x] Track candidate, selected, route, used-in-response, and estimated tokens saved.

### 6. Operations and product metrics

- [x] Add review backlog count to the administrator AI menu.
- [x] Report retrieval candidates, used hits, direct answers, injected answers, feedback rate, and estimated tokens saved.
- [x] Remove Skill and legacy capture statistics from the knowledge dashboard.
- [x] Keep maintenance backlog and safety suspension visible.

### 7. Verification

- [x] Add tests proving knowledge approval cannot create a Skill or Skill Candidate.
- [x] Add tests for first-downvote direct-answer degradation and report suspension.
- [x] Run backend tests, frontend lint/build, Prisma validation, migration checks, and `git diff --check`.
- [x] Treat cloud worker state and production retrieval quality as unconfirmed until live acceptance.
