# Controlled Chat System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled direct and group text chat to every role's notification center, with real-time delivery, unread/read state, stranger-message limits, admin moderation, sensitive-word blocking, audit records, and storage cleanup/export.

**Architecture:** PostgreSQL is source of truth. All writes use authenticated REST endpoints and database transactions; Socket.IO only distributes events after commit. Clients recover after reconnect through cursor-based REST history. Existing derived business notifications remain independent and appear beside chat through a shared notification-center shell.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16, Socket.IO, optional Redis Socket.IO adapter for multi-instance deployment, React 19, TypeScript, Tailwind CSS.

---

## Confirmed Product Rules

- Direct chat is allowed between all roles.
- Administrators and auditors are visible contacts.
- Other students are discoverable only by exact unified-code search.
- Direct conversations are unique per user pair.
- A student starting a new direct conversation with another student may send at most three messages until the recipient replies.
- The three-message limit never resets by date. Show the rule before the first message.
- The limit does not apply to conversations involving an administrator or auditor.
- Only administrators create groups, add members, remove members, rename groups, close groups, or dissolve groups.
- Auditors and students may only send messages in groups. They cannot invite or remove members.
- Normal groups allow at most 200 active members.
- One global group includes every active account. Membership is implicit, so new active accounts join automatically.
- Text only. Message body limit: 2,000 Unicode code points after trim and normalization.
- Sending is rate-limited per account: at most 10 accepted attempts per 10 seconds and 60 per minute. Rejected attempts do not consume stranger-message quota.
- Chat shows unread counts and read state. Direct messages show “已读”; group messages do not expose a full member-by-member read list.
- Administrators may disable a user's chat access, close conversations, inspect all chat records, manage sensitive words, export records, and delete records older than a selected cutoff.
- Sensitive-word matches block sending, tell the sender why, and create an audit record without storing the rejected full message.
- Storage warning appears at 80% of configured database quota.
- Export before deletion is offered but optional. Deletion requires a second confirmation.

## Important Storage Constraint

PostgreSQL has no intrinsic “maximum database capacity” value. Add `CHAT_DATABASE_QUOTA_BYTES` as an operator-configured logical quota. Compare `pg_database_size(current_database())` with that quota, while also reporting chat-table size separately.

Deleting old rows frees space for PostgreSQL reuse but may not immediately reduce the database file size. Do not run `VACUUM FULL` from the web application because it can lock tables. Let normal autovacuum reclaim reusable space; operators may schedule physical compaction separately.

## Data Model

Add these Prisma enums:

```prisma
enum ChatConversationType {
  DIRECT
  GROUP
  GLOBAL
}

enum ChatConversationStatus {
  OPEN
  CLOSED
  DISSOLVED
}

enum ChatMemberRole {
  OWNER
  MEMBER
}
```

Add these models and corresponding `User` relations:

```prisma
model ChatConversation {
  id                       String                 @id @default(cuid())
  type                     ChatConversationType
  status                   ChatConversationStatus @default(OPEN)
  title                    String?
  directKey                String?                @unique
  directInitiatorId        String?
  strangerMessageCount     Int                    @default(0)
  acceptedAt               DateTime?
  createdById              String
  closedById               String?
  closedReason             String?
  closedAt                 DateTime?
  createdAt                DateTime               @default(now())
  updatedAt                DateTime               @updatedAt
  createdBy                User                   @relation("ChatConversationCreator", fields: [createdById], references: [id])
  directInitiator          User?                  @relation("ChatDirectInitiator", fields: [directInitiatorId], references: [id])
  closedBy                 User?                  @relation("ChatConversationCloser", fields: [closedById], references: [id])
  members                  ChatConversationMember[]
  messages                 ChatMessage[]

  @@index([type, status])
  @@index([updatedAt])
}

model ChatConversationMember {
  id                 String           @id @default(cuid())
  conversationId     String
  userId             String
  role               ChatMemberRole   @default(MEMBER)
  joinedAt           DateTime         @default(now())
  removedAt          DateTime?
  lastReadMessageId  String?
  lastReadAt         DateTime?
  conversation       ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastReadMessage    ChatMessage?      @relation("ChatLastReadMessage", fields: [lastReadMessageId], references: [id], onDelete: SetNull)

  @@unique([conversationId, userId])
  @@index([userId, removedAt])
}

model ChatMessage {
  id              String                   @id @default(cuid())
  conversationId  String
  senderId        String
  clientMessageId String
  content         String                   @db.Text
  createdAt       DateTime                 @default(now())
  conversation    ChatConversation         @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender          User                     @relation("ChatMessageSender", fields: [senderId], references: [id])
  readCursors     ChatConversationMember[]  @relation("ChatLastReadMessage")

  @@unique([senderId, clientMessageId])
  @@index([conversationId, createdAt, id])
}

model ChatUserRestriction {
  id            String    @id @default(cuid())
  userId        String    @unique
  disabledById  String
  reason        String    @db.Text
  disabledAt    DateTime  @default(now())
  expiresAt     DateTime?
  liftedAt      DateTime?
  user          User      @relation("ChatRestrictedUser", fields: [userId], references: [id], onDelete: Cascade)
  disabledBy    User      @relation("ChatRestrictionOperator", fields: [disabledById], references: [id])

  @@index([expiresAt, liftedAt])
}

model ChatSensitiveWord {
  id             String   @id @default(cuid())
  term           String
  normalizedTerm String   @unique
  active         Boolean  @default(true)
  createdById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      User     @relation("ChatSensitiveWordCreator", fields: [createdById], references: [id])

  @@index([active])
}
```

Global group membership is implicit for every active user. A `ChatConversationMember` row is lazily upserted when a user reads the global group, only to hold that user's read cursor. Removed membership never applies to the global group.

Extend `AuditAction` with:

```prisma
CHAT_MESSAGE_BLOCKED
CHAT_CONVERSATION_MANAGED
CHAT_USER_RESTRICTED
CHAT_RECORDS_EXPORTED
CHAT_RECORDS_DELETED
CHAT_RECORDS_VIEWED
CHAT_SENSITIVE_WORD_MANAGED
```

## REST Contract

All endpoints require `JwtAuthGuard` and active account status.

```text
GET    /chat/bootstrap
GET    /chat/contacts/staff
GET    /chat/contacts/search?unifiedCode=...
GET    /chat/conversations?cursor=...
POST   /chat/conversations/direct
POST   /chat/conversations/group                 ADMIN
GET    /chat/conversations/:id/messages?before=...&limit=50
POST   /chat/conversations/:id/messages
POST   /chat/conversations/:id/read
PATCH  /chat/conversations/:id                   ADMIN
POST   /chat/conversations/:id/members            ADMIN
DELETE /chat/conversations/:id/members/:userId    ADMIN
POST   /chat/conversations/:id/close              ADMIN
POST   /chat/conversations/:id/reopen             ADMIN
POST   /chat/conversations/:id/dissolve           ADMIN

GET    /chat/admin/conversations                  ADMIN
GET    /chat/admin/conversations/:id/messages     ADMIN
POST   /chat/admin/restrictions                    ADMIN
DELETE /chat/admin/restrictions/:userId            ADMIN
GET    /chat/admin/sensitive-words                 ADMIN
POST   /chat/admin/sensitive-words                 ADMIN
PATCH  /chat/admin/sensitive-words/:id             ADMIN
DELETE /chat/admin/sensitive-words/:id             ADMIN
GET    /chat/admin/storage                         ADMIN
POST   /chat/admin/export                          ADMIN
POST   /chat/admin/cleanup/preview                 ADMIN
POST   /chat/admin/cleanup                         ADMIN
```

`POST /chat/conversations/:id/messages` body:

```json
{
  "clientMessageId": "browser-generated-uuid",
  "content": "message text"
}
```

Success returns persisted message. Duplicate `clientMessageId` returns original message, making retries idempotent.

User search accepts exact unified code only. Apply per-user and per-IP rate limits, return at most one active account, and never return email, status internals, or permissions.

Administrator record inspection writes `CHAT_RECORDS_VIEWED` with conversation ID and time range. It never copies message text into the audit log.

## Message Transaction

Each send executes in one PostgreSQL transaction:

1. Lock or conditionally update conversation row.
2. Verify sender is an active member, or active user for global group.
3. Reject closed/dissolved conversation.
4. Reject active `ChatUserRestriction`.
5. Normalize text with Unicode NFKC, trim whitespace, reject empty or over 2,000 code points.
6. Match active sensitive words against normalized text.
7. If blocked, insert only an audit log containing conversation ID, sender ID, matched sensitive-word ID, and SHA-256 content hash, then commit the transaction. Return the blocked result after commit instead of throwing inside the transaction, otherwise the audit row would roll back. Never store rejected plaintext.
8. For student-to-student direct chat, if sender is initiator and `acceptedAt` is null, conditionally increment `strangerMessageCount` only while below 3. Reject when update count is zero.
9. If recipient sends first reply, set `acceptedAt = now()`.
10. Insert `ChatMessage` using unique `clientMessageId`.
11. Update conversation `updatedAt`.
12. Commit, then publish `message.created`.

This order prevents concurrent requests from bypassing the three-message cap.

## Real-Time Contract

Use Socket.IO namespace `/chat`. Client sends access JWT in `auth.token`. Gateway verifies signature, token type, account status, and chat restriction state before joining rooms. Schedule disconnect at JWT `exp`; reconnect must authenticate with a refreshed access token.

Rooms:

```text
user:{userId}
conversation:{conversationId}
global
admin:chat
```

Server events:

```text
message.created
message.read
conversation.updated
conversation.closed
conversation.dissolved
conversation.memberChanged
chat.restrictionChanged
chat.storageWarning
```

Socket events contain IDs and display-safe summaries, never authorization decisions. Server chooses rooms from authorized membership; clients cannot join arbitrary room names. On reconnect, client calls `/chat/bootstrap` and reloads messages after its latest cursor. If backend later runs multiple replicas, enable `@socket.io/redis-adapter` using existing `REDIS_URL`; PostgreSQL remains source of truth.

## Notification-Center UX

Replace duplicate role-specific notification implementations with shared shell:

```text
NotificationCenter
├── segmented control: 通知 | 消息
├── 通知: existing derived notification channels
└── 消息
    ├── conversation list + unread badges
    ├── message timeline
    ├── text composer
    └── admin management drawer (ADMIN only)
```

Desktop uses conversation list plus message pane. Mobile shows one pane at a time with back navigation. Preserve platform green as active/accent color; use restrained neutral surfaces and existing 8px radius.

Contact dialog:

- Staff tab lists all active administrators and auditors.
- User tab accepts exact unified code and shows one result.
- Before first student-to-student message, show: `对方回复前最多发送 3 条消息；未回复时额度不会按天恢复。`
- Composer shows remaining `3 / 2 / 1 / 0` before acceptance.
- At zero, disable composer and explain that recipient must reply.

Global group:

- Exactly one `GLOBAL` conversation, pinned first.
- All active accounts can read and send unless chat-disabled.
- Only administrators rename or close it.
- It cannot remove individual members or dissolve accidentally; require typed confirmation for global-group closure.

Admin management drawer:

- Search and inspect all conversations.
- Close/reopen normal conversations with required reason.
- Disable/restore a user's chat access with required reason and optional expiry.
- Manage group members and sensitive words.
- Show configured quota, total database usage, chat table usage, warning threshold, and last measurement time.
- Cleanup flow: choose cutoff -> preview message count/date range -> optional JSONL export -> explicit confirmation -> delete.
- Cleanup preview returns a short-lived signed token binding cutoff and preview count. Cleanup requires that token, preventing a stale or modified confirmation request.

Because administrators can inspect messages, show a compact privacy notice in chat: `平台聊天受安全审计，管理员可按管理规则查看记录。` Do not claim end-to-end encryption.

## File Map

Create backend files:

```text
backend/src/modules/chat/chat.module.ts
backend/src/modules/chat/chat.controller.ts
backend/src/modules/chat/chat-admin.controller.ts
backend/src/modules/chat/chat.service.ts
backend/src/modules/chat/chat-admin.service.ts
backend/src/modules/chat/chat-policy.service.ts
backend/src/modules/chat/chat-realtime.gateway.ts
backend/src/modules/chat/chat-realtime.publisher.ts
backend/src/modules/chat/chat.validation.ts
backend/src/modules/chat/chat.types.ts
backend/src/modules/chat/chat-storage.service.ts
backend/src/modules/chat/chat-export.service.ts
backend/src/modules/chat/chat-socket-auth.service.ts
backend/src/modules/chat/chat-rate-limit.service.ts
```

Create frontend files:

```text
frontend/src/services/chat.ts
frontend/src/hooks/useChatSocket.ts
frontend/src/components/chat/ChatCenter.tsx
frontend/src/components/chat/ConversationList.tsx
frontend/src/components/chat/MessageTimeline.tsx
frontend/src/components/chat/MessageComposer.tsx
frontend/src/components/chat/ContactDialog.tsx
frontend/src/components/chat/GroupDialog.tsx
frontend/src/components/chat/ChatAdminDrawer.tsx
frontend/src/components/ui/NotificationCenter.tsx
```

Modify:

```text
database/prisma/schema.prisma
backend/src/app.module.ts
backend/src/main.ts
backend/src/config/env.ts
backend/.env.example
backend/src/modules/rbac/permissions.ts
backend/package.json
frontend/package.json
frontend/src/pages/user/UserNotifications.tsx
frontend/src/components/ui/NotificationPanel.tsx
frontend/src/services/apiClient.ts
frontend/src/pages/user/UserHome.tsx
frontend/src/pages/admin/AdminHome.tsx
frontend/src/pages/auditor/AuditorHome.tsx
```

Add permissions `chat:use` to all roles and `chat:manage` to administrators. Role checks remain mandatory for group-management operations even if an override grants a permission unexpectedly.

## Delivery Tasks

### Task 1: Database schema and migration

- [ ] Add chat enums, models, relations, indexes, and audit actions to `database/prisma/schema.prisma`.
- [ ] Create migration `database/prisma/migrations/20260713120000_controlled_chat/migration.sql`.
- [ ] Add partial database constraints in SQL: only one `GLOBAL` row and valid direct `directKey` values.
- [ ] Run `npm run prisma:validate` and `npm run prisma:generate` from `backend`.
- [ ] Commit as `feat(chat): add persistent chat schema`.

### Task 2: Policy and validation tests

- [ ] Add `backend/test/chat-policy.test.ts` covering role permissions, group size, exact-code search, text normalization, sensitive matches, and stranger quota.
- [ ] Add backend script `"test:chat": "tsx --test test/chat-*.test.ts"`, using Node's built-in test runner; add no new test framework.
- [ ] Implement `chat-policy.service.ts`, `chat.validation.ts`, and `chat.types.ts` until tests pass.
- [ ] Ensure tests cover four concurrent initiator sends: exactly three persist, one receives `STRANGER_LIMIT_REACHED`.
- [ ] Commit as `feat(chat): enforce chat policy`.

### Task 3: Conversation and message REST API

- [ ] Add cursor-based conversation/history reads and idempotent message writes.
- [ ] Add per-account message and exact-search rate limits; use Redis when configured and a bounded in-process limiter only in single-instance development.
- [ ] Return `strangerRemaining`, `accepted`, `canSend`, `closedReason`, unread count, and last-message summary in conversation DTOs.
- [ ] Add API tests for direct uniqueness, global implicit access, removed-member denial, and read cursor updates.
- [ ] Commit as `feat(chat): add conversation API`.

### Task 4: Administrator controls

- [ ] Add group CRUD, membership control, conversation close/reopen, user restrictions, and sensitive-word management.
- [ ] Require reason text for restriction, close, reopen, and cleanup operations.
- [ ] Write audit entries without rejected-message plaintext.
- [ ] Add tests proving auditor and student requests receive `403` for every management endpoint.
- [ ] Commit as `feat(chat): add moderation controls`.

### Task 5: Storage measurement, export, and cleanup

- [ ] Add `CHAT_DATABASE_QUOTA_BYTES` validation; reject missing/invalid quota in production and allow a documented development default.
- [ ] Measure `pg_database_size(current_database())` and chat relation/index sizes.
- [ ] Stream cutoff-scoped JSONL export with UTF-8 metadata header; do not buffer full export in process memory.
- [ ] Add cleanup preview and confirmed deletion endpoints using a short-lived signed preview token.
- [ ] Emit warning only when crossing 80%, then once per 24 hours while still above threshold.
- [ ] Test cutoff boundaries and verify newer messages remain.
- [ ] Commit as `feat(chat): add storage retention controls`.

### Task 6: Real-time delivery

- [ ] Install NestJS WebSocket and Socket.IO dependencies plus frontend `socket.io-client`.
- [ ] Authenticate socket handshake and authorize every room join.
- [ ] Publish only after successful transaction commit.
- [ ] Add reconnect path that reloads REST cursors before accepting new socket events.
- [ ] Test unauthorized join, cross-conversation isolation, reconnect recovery, and duplicate-event deduplication.
- [ ] Commit as `feat(chat): add real-time message delivery`.

### Task 7: Shared notification-center shell

- [ ] Extract existing notice UI into shared `NotificationCenter` without changing existing notice behavior.
- [ ] Replace `UserNotifications` and `NotificationPanel` duplicate layouts with wrappers around shared shell.
- [ ] Add `通知/消息` segmented control and role-consistent max width `1360px`.
- [ ] Verify admin, auditor, and student routes all render same shell.
- [ ] Commit as `refactor(notifications): share notification center`.

### Task 8: Chat user interface

- [ ] Build conversation list, unread badges, cursor pagination, message timeline, read markers, and text composer.
- [ ] Build staff directory and exact unified-code search.
- [ ] Show stranger-rule confirmation before first student-to-student message and remaining quota thereafter.
- [ ] Handle blocked word, closed conversation, disabled chat, reconnecting, send retry, and empty states.
- [ ] Add responsive one-pane mobile navigation.
- [ ] Commit as `feat(chat): add notification-center chat UI`.

### Task 9: Group and admin UI

- [ ] Add administrator-only group creation and management dialogs.
- [ ] Enforce 200-member normal-group limit in both UI and backend.
- [ ] Add moderation drawer for conversation inspection, restrictions, sensitive words, storage, export, and cleanup.
- [ ] Add typed confirmation for global-group closure and record deletion.
- [ ] Commit as `feat(chat): add chat administration UI`.

### Task 10: End-to-end verification

- [ ] Add `tests/e2e/chat-e2e.mjs` using administrator, auditor, and two student accounts.
- [ ] Verify every role pair can chat and receive messages without refresh.
- [ ] Verify fourth unanswered student message is blocked and reply unlocks sending.
- [ ] Verify only administrator creates/manages groups.
- [ ] Verify all active users see global group.
- [ ] Verify sensitive match blocks persistence and creates sanitized audit record.
- [ ] Verify unread/read state survives logout and another device.
- [ ] Verify export downloads and cleanup deletes only records before cutoff.
- [ ] Run backend build, frontend build, core smoke tests, and chat E2E.
- [ ] Commit as `test(chat): cover controlled chat workflows`.

## Acceptance Criteria

- No message appears in real time unless already committed to PostgreSQL.
- Reconnect and retry cannot lose or duplicate committed messages.
- Student stranger quota cannot exceed three under concurrent requests.
- User discovery cannot enumerate accounts.
- Group management cannot be granted to auditor/student by frontend manipulation.
- Sensitive rejected plaintext is absent from message and audit tables.
- Read state follows account across browsers; it is not stored only in `localStorage`.
- Global group automatically includes newly active accounts.
- Storage warning is based on configured quota and appears at 80%.
- Cleanup is cutoff-scoped, previewed, audited, and does not require export.
- Existing business notifications still work for all roles.

## Recommended Delivery Order

Ship in three independently testable increments:

1. Direct text chat, stranger quota, read/unread, real-time delivery.
2. Administrator-created groups and global group.
3. Moderation, sensitive words, storage warning, export, cleanup.

Do not merge storage deletion before export and cutoff tests pass. Do not expose chat to users before socket room authorization and REST membership tests pass.
