# Persistent Notification Delivery Implementation Plan

> **For agentic workers:** Implement tasks inline and verify each boundary before proceeding.

**Goal:** Build durable, multi-device notification delivery for vulnerability, certificate, and account-security events with role-aware red dots, realtime refresh, privacy-safe email, deep links, idempotency, and auditability.

**Architecture:** Business transactions create immutable recipient notifications using a unique event key. Read state lives in PostgreSQL; notification APIs return channel messages plus aggregate scopes for navigation badges. After commit, realtime events notify connected users and required email is attempted once; failures create audit records and never roll back business state.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Socket.IO, React, TypeScript.

## Global Constraints

- Important vulnerability events email the submitter: supplement required, rejected, confirmed valid, archived, certificate issued.
- New reports and normal staff workflow events remain station-only.
- Password/email changes and administrator unfamiliar-IP login are important security events.
- Email exposes only report number and title; details remain inside authenticated pages.
- Email delivery is mandatory, attempted once, and failure is audited without retry.
- Red dots clear when the corresponding notification or entity detail is viewed.
- Realtime WebSocket refresh has focus refresh and 60-second polling fallback.
- Existing unrelated worktree changes must remain untouched.

---

### Task 1: Durable notification model and API

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260721120000_persistent_notifications/migration.sql`
- Modify: `backend/src/modules/notifications/notifications.service.ts`
- Modify: `backend/src/modules/notifications/notifications.controller.ts`

- [x] Add notification category, scope, entity metadata, unique event key, read timestamp, and email delivery audit fields.
- [x] Return server-side unread totals by bell and business menu scope.
- [x] Add idempotent single-message, channel, and entity read endpoints.
- [x] Preserve legacy generated announcement/point/system channels while durable event rollout begins.

### Task 2: Business event production and email delivery

**Files:**
- Modify: `backend/src/modules/vulnerabilities/vulnerabilities.service.ts`
- Modify: `backend/src/modules/certificates/certificates.service.ts`
- Modify: `backend/src/modules/notifications/notifications.module.ts`
- Create: `backend/src/modules/notifications/notification-delivery.service.ts`

- [x] Produce recipient and staff notifications from report submission, supplement, review, retest/archive, and certificate issuance.
- [x] Use deterministic event keys to prevent duplicate notification and email delivery.
- [x] Send privacy-safe required email once after commit and audit failures.
- [x] Ensure delivery failures never revert completed report or certificate transactions.

### Task 3: Realtime and frontend read state

**Files:**
- Create: `backend/src/modules/notifications/notifications.gateway.ts`
- Modify: `frontend/src/services/notifications.ts`
- Modify: `frontend/src/components/ui/NotificationChatCenter.tsx`
- Modify: `frontend/src/components/ui/NotificationPanel.tsx`

- [x] Emit user-targeted `notification.created` events over authenticated Socket.IO connections.
- [x] Replace localStorage notification read calculations with server unread values and read APIs.
- [x] Refresh on realtime event, focus, and 60-second fallback polling.
- [x] Open deep links and mark the selected notification or entity as read.

### Task 4: Role-aware navigation red dots and verification

**Files:**
- Modify: `frontend/src/components/navigation/ScrollableNav.tsx`
- Modify: `frontend/src/pages/user/UserHome.tsx`
- Modify: `frontend/src/pages/admin/AdminHome.tsx`
- Modify: `frontend/src/pages/auditor/AuditorHome.tsx`
- Add focused backend/frontend tests where existing test seams permit.

- [x] Display red dots for user vulnerability/certificate menus, admin vulnerability/certificate menus, and auditor review/retest/certificate menus.
- [x] Clear entity-scoped unread state when matching detail is viewed.
- [x] Run Prisma generation, backend build/tests, frontend build/tests, and review changed diff for privacy and authorization regressions.
