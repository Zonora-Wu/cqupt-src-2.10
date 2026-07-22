# AI PDF Vulnerability Report Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute tasks inline with focused tests and review after each vertical slice.

**Goal:** Connect PDF report upload in the student AI assistant to backend text extraction, field-level redaction, fixed-standard Hermes analysis, editable direct submission, and automatic original-PDF attachment upload.

**Architecture:** The existing local PDF parser remains the only component that sees raw PDF text. A dedicated report-analysis endpoint reparses the selected draft server-side, builds a redacted structured context capped at 5000 characters, and calls Hermes for a validated JSON assessment. Vulnerability creation uses one shared backend completeness validator for every entry point; the AI dialog reuses existing create-and-upload behavior with the original in-memory file.

**Tech Stack:** NestJS, Prisma, pdf-parse, React, TypeScript, existing OpenAI-compatible Hermes gateway.

## Global Constraints

- Only text-based PDFs are supported; no OCR.
- One PDF may contain multiple vulnerabilities, but only one selected vulnerability is analyzed and submitted per operation.
- Raw PDFs are never modified or sent to Hermes.
- Agent context is field-level redacted and at most 5000 characters.
- Agent score is advisory and never a submission gate.
- Backend completeness, access rules, permissions, acknowledgement, and confirmation are submission gates.
- Fixed report-review standard; no administrator editor in this phase.
- Existing platform AlertMessage and modal visual language must be reused.

---

### Task 1: Shared vulnerability completeness contract

**Files:**
- Modify: `backend/src/modules/vulnerabilities/vulnerability.types.ts`
- Modify: `backend/src/modules/vulnerabilities/vulnerability.validation.ts`
- Modify: `frontend/src/services/vulnerabilities.ts`
- Test: `backend/test/vulnerability-submission-validation.test.ts`

**Produces:** A normalized create payload requiring meaningful title, asset, type, severity, reproduction, impact, repair, and test-boundary content, independent of Markdown formatting.

- [x] Add behavior tests for structured Markdown, explicit plain fields, missing sections, and placeholder-only values.
- [x] Extend create body with optional explicit report fields.
- [x] Implement shared lenient completeness checks.
- [x] Run focused tests and backend typecheck.

### Task 2: Safe selected-draft analysis preparation

**Files:**
- Modify: `backend/src/modules/ai/ai.types.ts`
- Modify: `backend/src/modules/ai/ai.report-draft.service.ts`
- Test: `backend/test/ai-report-analysis.test.ts`

**Produces:** `prepareVulnerabilityAnalysis(file, draftId)` returning selected draft, redacted context, omitted-field reasons, image-evidence notice, and context length.

- [x] Test multi-draft selection, stable asset placeholders, credential removal, unresolved-field omission, prompt-injection treatment, and 5000-character limit.
- [x] Preserve raw file buffer only inside request scope.
- [x] Build fixed review-standard prompt data.
- [x] Run focused tests and backend typecheck.

### Task 3: Hermes report-analysis endpoint

**Files:**
- Modify: `backend/src/modules/ai/ai.controller.ts`
- Modify: `backend/src/modules/ai/ai.service.ts`
- Modify: `backend/src/modules/ai/ai.types.ts`
- Modify: `frontend/src/services/ai.ts`

**Produces:** `POST /ai/report-analysis` multipart endpoint accepting `file` and `draftId`, returning selected editable draft plus validated Agent assessment.

- [x] Add multipart input validation and permission guard.
- [x] Send only redacted structured context and fixed rubric to Hermes.
- [x] Parse and clamp structured score, strengths, improvements, limitations, summary, and disclaimer.
- [x] Record token usage and sanitized audit metadata without report content.
- [x] Run backend typecheck and build.

### Task 4: AI assistant selection and analysis flow

**Files:**
- Modify: `frontend/src/pages/user/UserAIAssistant.tsx`
- Modify: `frontend/src/services/ai.ts`

**Produces:** PDF upload, local draft list selection, selected Agent analysis, advisory score, unified notices, and editable simplified report card.

- [x] Keep original File in memory and associate it with selected draft.
- [x] Show draft-selection dialog when multiple vulnerabilities are found.
- [x] Call report-analysis only after selection.
- [x] Show score, restrained supportive summary, improvements, redaction limitations, and image warning.
- [x] Preserve responsive and dark-mode behavior.

### Task 5: Direct submission parity

**Files:**
- Modify: `frontend/src/pages/user/UserAIAssistant.tsx`
- Modify: `frontend/src/services/vulnerabilities.ts`

**Produces:** Simplified editable card with acknowledgement checkbox, confirmation dialog, shared backend validation, create request, and automatic original-PDF upload.

- [x] Add all required structured fields without requiring Markdown editing.
- [x] Require same three-rule acknowledgement.
- [x] Reuse access-status checks.
- [x] Add confirmation modal and duplicate-submit lock.
- [x] Keep success in conversation with report number and detail link.
- [x] Surface attachment upload failure while retaining created report.

### Task 6: Verification and documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-07-22-ai-pdf-report-analysis.md`

- [x] Run backend focused tests, typecheck, and production build.
- [x] Run frontend production build; targeted lint still reports one pre-existing effect-state error and one pre-existing hook dependency warning in `UserAIAssistant.tsx`.
- [x] Run diff checks and inspect no raw PDF text appears in audit logs.
- [x] Update this plan with completed checkboxes and implementation notes.

## Implementation Notes

- PDF uploads in the AI assistant now always use the report pipeline. Raw PDF excerpts are no longer sent through generic chat attachment context.
- Both report parsing and analysis endpoints require `ai:use_student` and enforce the platform's 10 MB report limit.
- Audit records contain file hash, file size, redaction counts, omitted field names, score, model, and token totals only. They do not contain report text.
- Agent scoring is advisory. Submission is controlled by access status, shared backend completeness validation, acknowledgement, confirmation, and the existing vulnerability permissions.
- Original PDF remains unchanged and uploads only after vulnerability creation. If upload fails, the created report number is retained and the user is directed to supplement it from My Vulnerabilities.
- The My Vulnerabilities "AI Advice" action reuses the same rubric, redaction, quota, and audit path against the user's stored structured report. It opens an assessment-only AI message and never renders submission controls.
