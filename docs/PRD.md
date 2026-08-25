# YUENVOICE — Product Requirements Document

> Version: 1.1
> Last Updated: 2026-05-02

---

## 1. Overview / 概述

**YUENVOICE** is a Progressive Web App (PWA) designed for a single Hong Kong housing estate. It serves as a unified digital communication platform connecting residents (業戶), the Owners' Corporation (業主立案法團), and the property management office (管理處).

### Problem Statement / 問題陳述

Hong Kong housing estates currently rely on fragmented, outdated communication methods:

- Paper notices on notice boards are easily missed or damaged
- Residents have no transparent way to track the progress of maintenance requests or complaints
- Owners' Corporation documents (meeting minutes, financial reports) are difficult to distribute and access
- There is no structured channel for resident-to-resident communication within the estate
- Emergency notices (e.g. water supply suspension, lift maintenance) cannot reach all residents promptly

### Vision / 願景

Replace fragmented paper-based and informal communication with a single, accessible PWA that ensures transparency, accountability, and community engagement for all estate stakeholders.

---

## 2. Tech Stack / 技術架構

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| ORM / Migrations / Seeds | Drizzle ORM + Drizzle Kit + `wrangler d1 migrations` |
| Sessions / tokens / push subs | Durable Object (`SessionStore`) |
| Mutable runtime config | Cloudflare KV (`admin:password`) |
| Push Notifications | Web Push API (VAPID) |
| PWA | Service Worker + Web App Manifest |
| File Storage | Cloudflare R2 |
| Authentication | JWT (access + refresh tokens) |
| Hosting | Single Cloudflare Worker serving both the API and the SPA |

---

## 3. Registration & Authentication / 註冊與認證

### 3.1 Flat-Based Registration / 單位註冊制

Each flat (unit) in the estate is pre-assigned a unique **registration password (註冊密碼)** by the management office. This password acts as a gatekeeper — only residents who possess the correct password for their flat can create an account.

**Registration Flow / 註冊流程:**

1. User selects their block (座) and flat number (單位號碼)
2. User enters the **flat registration password (單位註冊密碼)** provided by management
3. System validates the password against the flat record
4. If valid, user proceeds to set up their personal account (name, email/phone, login password)
5. If invalid, registration is rejected with an error message
6. Upon successful registration, user is linked to the flat and assigned the **Resident (業戶)** role

**Management Controls:**

- Management office can generate and regenerate flat passwords at any time
- Regenerating a password does not affect existing registered users
- Multiple residents can register under the same flat (e.g. family members)
- Management can deactivate a flat's registration to prevent further sign-ups

### 3.2 Authentication / 認證

- Login via email/phone + password
- JWT-based session management (access token + refresh token)
- Access token short-lived (15 min), refresh token longer-lived (7 days)
- Password reset via email/SMS verification

---

## 4. User Roles & Permissions / 用戶角色與權限

### 4.1 Role Definitions / 角色定義

| Role | Chinese | Description |
|------|---------|-------------|
| Resident | 業戶 | General estate resident. Can submit reports, participate in discussions, view notices and OC documents. |
| OC Committee Member | 業主立案法團委員 | Elected member of the Owners' Corporation management committee. Can publish official OC documents, resolutions, and meeting minutes. |
| Management Office Staff | 管理處職員 | Property management staff. Can handle incident reports, push notifications, manage estate configuration, and moderate discussions. |
| System Admin | 系統管理員 | Technical administrator. Full access to user management, system configuration, and audit logs. |

### 4.2 Permission Matrix / 權限矩陣

OC committee is **review-only** on residents' tickets and the discussion board: they observe everything mgmt sees on the report side, but cannot create or comment. They retain full read access plus reactions and post flags so they can still acknowledge content and escalate it for moderation. Their write capability is limited to the OC document hub (their statutory role).

| Feature | Resident | OC Committee | Mgmt Staff | Admin |
|---------|----------|-------------|------------|-------|
| Submit incident report | Yes | — (review-only) | Yes | Yes |
| View own reports | Yes | — | Yes | Yes |
| View all reports | — | Yes (read-only) | Yes | Yes |
| Comment on report | Yes (own) | — (review-only) | Yes (incl. internal notes) | Yes |
| Attach files to report | Yes | — | Yes | Yes |
| Update report status | — | — | Yes | Yes |
| View internal mgmt notes | — | — | Yes | Yes |
| Create discussion post | Yes | — (review-only) | Yes | Yes |
| Post anonymously | Yes | — | — | — |
| Comment on post | Yes | — (review-only) | Yes | Yes |
| React (like) to post | Yes | Yes | Yes | Yes |
| Flag post for moderation | Yes | Yes | Yes | Yes |
| Moderate (hide / pin / delete) | — | — | Yes | Yes |
| View OC documents | Yes | Yes | Yes | Yes |
| Publish OC documents (file or link) | — | Yes | Yes | Yes |
| Delete OC documents | — | Yes | Yes | Yes |
| Send push notifications | — | — | Yes | Yes |
| Re-push existing notification | — | — | Yes | Yes |
| Link additional flats to own account | Yes | Yes | — | — |
| Manage flat passwords | — | — | — | Yes |
| Create / edit / delete flats | — | — | — | Yes |
| Manage users / roles | — | — | — | Yes |
| Create non-resident user (no flat) | — | — | — | Yes |
| View audit logs | — | — | — | Yes |

---

## 5. Core Features / 核心功能

### 5.1 Management Communication Channel / 管理處溝通渠道

A structured system for residents to submit reports to the management office and track their resolution progress.

**Incident Types / 事件類型:**

| Type | Chinese | Example |
|------|---------|---------|
| Repair | 故障維修 | Lift malfunction, water leak, broken facility |
| Complaint | 投訴 | Noise, hygiene issues, unauthorized construction |
| Inquiry | 查詢 | Fee clarification, facility booking, rules enquiry |

**Report Fields:**

- Title (標題)
- Type (類型): Repair / Complaint / Inquiry
- Description (詳細描述): free text
- Location (位置): block, floor, area
- Photo/file attachments (附件): up to 5 images or documents
- Priority (優先級): set by management upon review

**Status Tracking / 狀態追蹤:**

| Status | Chinese | Description |
|--------|---------|-------------|
| Pending | 待處理 | Report submitted, awaiting management review |
| In Progress | 跟進中 | Management has acknowledged and is working on it |
| Completed | 已完成 | Issue resolved and closed |

**Auto-Reopen on Resident Follow-Up / 業主追問自動重開:**

If a resident comments on a report whose status is `completed`, the system automatically:

1. Transitions the status back to `in_progress`
2. Writes an `auto_reopen` audit log entry
3. Notifies every active mgmt_staff/admin user via in-app notification + web push

The UI warns the resident before they comment that posting will reopen the ticket. Mgmt comments do **not** trigger auto-reopen (they may legitimately add closing remarks).

**Additional Features:**

- Management can add internal notes (`is_internal=true` — not visible to residents/committee)
- Management can add reply messages visible to the reporter
- Residents receive push notification on status changes
- Report history searchable and filterable by status, type, date
- Multiple reporters via multi-unit ownership: a report's "own" scope follows `User.id`, not flat — owners with multiple flats see one consolidated list

---

### 5.2 Resident Discussion Board / 業戶討論空間

A community forum for residents to communicate, share information, and organize activities within the estate.

**Structure:**

- Discussion boards organized by **block (座)** and **floor (樓層)**
- An estate-wide general board for cross-block topics
- Each board displays posts in reverse-chronological order

**Post Features:**

- Title + body text
- **Photo upload (圖片上載)**: residents can attach photos to posts (up to 5 images per post)
- Reply/comment threads
- Like/reaction system

**Anonymous Mode / 匿名模式:**

- Residents can choose to post or reply anonymously
- Anonymous identity is displayed as "匿名業戶" (Anonymous Resident)
- True identity is stored in the database but only accessible by System Admin for moderation purposes
- Anonymous posting helps lower the psychological barrier for residents to voice concerns

**Moderation:**

- Management staff can pin, hide, or delete posts that violate community guidelines
- Reported post mechanism — residents can flag inappropriate content
- Auto-flag posts containing sensitive keywords (configurable by admin)

---

### 5.3 OC Information Hub / 業主立案法團資訊發佈

A dedicated section for the Owners' Corporation management committee to publish official documents and announcements.

**Document Types / 文件類型:**

| Type | Chinese | Frequency |
|------|---------|-----------|
| Meeting Minutes | 會議記錄 | Per meeting |
| Financial Statements | 財務報表 | Annually (as required by Cap. 344) |
| Resolution Announcements | 決議公告 | As needed |
| General Notices | 一般通知 | As needed |

**Features:**

- Document upload supporting PDF, images, and common office formats
- In-app PDF viewer (no need to download separately)
- Documents organized by year and category
- Search by title and content
- OC Committee members can publish; Residents have read-only access

**Compliance / 合規:**

Per the Hong Kong Building Management Ordinance (Cap. 344, Schedule 7), the Owners' Corporation must:
- Prepare financial statements at least once every 12 months
- Make financial statements available for inspection by owners

YUENVOICE supports compliance by providing a digital channel for timely and accessible publication of these documents to all owners.

---

### 5.4 Push Notification System / 推送通知系統

A targeted push notification system enabling the management office to deliver timely updates to residents, replacing traditional paper-based notice boards.

**Targeting Options / 推送目標:**

| Target | Chinese | Use Case |
|--------|---------|----------|
| All Residents | 全體業戶 | Estate-wide announcements |
| By Block | 按座 | Block-specific maintenance |
| By Floor | 按樓層 | Floor-specific issues |

**Notification Categories / 通知類別:**

| Category | Chinese | Example |
|----------|---------|---------|
| Urgent | 緊急 | Water supply suspension, emergency evacuation |
| General | 一般 | Scheduled maintenance, policy update |
| Event | 活動 | Community event, festival celebration |

**Technical Implementation:**

- Web Push API with VAPID keys for browser-based push; subscriptions stored per device in the `SessionStore` Durable Object
- Notification center in-app with read/unread status (polled via TanStack Query — no realtime transport yet)
- Targets: all residents, a block, a floor, or a single user (individual reminders)
- Push permission prompt on first login with option to enable/disable later

**Auto-Triggered Notifications:**

- Incident report status change → notify reporter
- New OC document published → notify all residents
- New discussion post in subscribed board → notify subscribers

---

## 6. Data Models / 數據模型

### 6.1 Core Entities

```
User (用戶)
├── id (UUID)
├── email
├── phone
├── password_hash
├── name
├── flat_id (FK → Flat, nullable — null for non-resident mgmt/committee/admin)
├── role (enum: resident, oc_committee, mgmt_staff, admin)
├── is_active
├── created_at
└── updated_at

UserFlat (業主多單位連結 — join table for multi-unit owners)
├── user_id (FK → User, composite PK)
├── flat_id (FK → Flat, composite PK)
├── linked_at
├── created_at
└── updated_at

Flat (單位)
├── id (UUID)
├── block (座)
├── floor (樓層)
├── unit_number (單位號碼)
├── registration_password_hash
├── is_registration_open
├── created_at
└── updated_at

IncidentReport (事件報告)
├── id (UUID)
├── reporter_id (FK → User)
├── type (enum: repair, complaint, inquiry)
├── title
├── description
├── location_block
├── location_floor
├── location_area
├── status (enum: pending, in_progress, completed)
├── priority (enum: low, medium, high, urgent)
├── created_at
└── updated_at

IncidentAttachment (事件附件)
├── id (UUID)
├── report_id (FK → IncidentReport)
├── file_path
├── file_type
├── file_size
└── created_at

IncidentComment (事件回覆)
├── id (UUID)
├── report_id (FK → IncidentReport)
├── author_id (FK → User)
├── content
├── is_internal (boolean, mgmt-only notes)
└── created_at

DiscussionBoard (討論板)
├── id (UUID)
├── name
├── scope_type (enum: estate, block, floor)
├── scope_block (nullable)
├── scope_floor (nullable)
└── created_at

DiscussionPost (討論帖文)
├── id (UUID)
├── board_id (FK → DiscussionBoard)
├── author_id (FK → User)
├── title
├── body
├── is_anonymous (boolean)
├── is_hidden (boolean)
├── is_pinned (boolean)
├── created_at
└── updated_at

PostImage (帖文圖片)
├── id (UUID)
├── post_id (FK → DiscussionPost)
├── file_path
├── file_size
└── created_at

PostComment (帖文回覆)
├── id (UUID)
├── post_id (FK → DiscussionPost)
├── author_id (FK → User)
├── content
├── is_anonymous (boolean)
├── created_at
└── updated_at

PostReaction (帖文反應)
├── id (UUID)
├── post_id (FK → DiscussionPost)
├── user_id (FK → User)
├── type (enum: like, etc.)
└── created_at

OcDocument (法團文件)
├── id (UUID)
├── publisher_id (FK → User)
├── type (enum: meeting_minutes, financial_statement, resolution, notice,
│         meeting_livestream, meeting_recording)
├── title
├── description
├── file_path (nullable — set for file-backed documents)
├── external_url (nullable — set for link-backed documents)
├── link_type (enum: google_meet, google_drive, google_site — nullable)
├── year
├── created_at
└── updated_at

Notification (通知)
├── id (UUID)
├── sender_id (FK → User)
├── title
├── body
├── category (enum: urgent, general, event)
├── target_type (enum: all, block, floor)
├── target_block (nullable)
├── target_floor (nullable)
├── created_at
└── updated_at

UserNotification (用戶通知)
├── id (UUID)
├── notification_id (FK → Notification)
├── user_id (FK → User)
├── is_read (boolean)
└── read_at (nullable)

AuditLog (審計日誌)
├── id (UUID)
├── user_id (FK → User)
├── action
├── entity_type
├── entity_id
├── metadata (JSONB)
└── created_at
```

---

## 7. API Overview / API 概覽

> RBAC notes below show which roles can call each endpoint. `auth` means any authenticated user. Endpoints with no RBAC note accept all authenticated users.

### 7.1 Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with flat password |
| POST | `/api/auth/login` | Login, returns JWT pair |
| POST | `/api/auth/refresh` | Refresh access token (rotates refresh token) |
| POST | `/api/auth/logout` | Invalidate refresh token |
| POST | `/api/auth/verify-flat-password` | Pre-check a flat's registration password |
| POST | `/api/auth/forgot-password` | Issue a 1-hour reset token (always 200 — no enumeration) |
| POST | `/api/auth/reset-password` | Consume the reset token and set a new password |

> Forgot/reset-password are implemented server-side, but **no email/SMS delivery is wired** —
> the reset token is currently only written to the Worker log.

### 7.2 Incident Report Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/reports` | Create incident report (multipart, optional attachments) | resident, mgmt_staff, admin |
| GET | `/api/reports` | List reports — residents see own; committee/mgmt/admin see all | auth |
| GET | `/api/reports/:id` | Get report detail (filters internal comments for non-mgmt) | auth |
| PATCH | `/api/reports/:id/status` | Update report status (audit logged, notifies reporter) | mgmt_staff, admin |
| POST | `/api/reports/:id/comments` | Add comment (auto-reopens completed reports for residents) | resident, mgmt_staff, admin |
| POST | `/api/reports/:id/attachments` | Upload attachments (max 5 files) | resident, mgmt_staff, admin |

### 7.3 Discussion Endpoints

Boards are scoped: estate-wide boards are visible to everyone; block/floor boards are visible only to users whose flat (or any linked flat via `user_flats`) matches that block/floor. Mgmt and admin see all boards.

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/boards` | List boards accessible to the user | auth |
| GET | `/api/boards/:id/posts` | List posts (pinned first, hidden filtered for non-mgmt) | auth |
| POST | `/api/boards/:id/posts` | Create post with optional photos + anonymous flag | resident, mgmt_staff, admin |
| GET | `/api/posts/:id` | Get post detail (images, comments, reactions) | auth |
| POST | `/api/posts/:id/comments` | Add comment (supports anonymous) | resident, mgmt_staff, admin |
| POST | `/api/posts/:id/reactions` | Toggle reaction (`like`) | auth |
| POST | `/api/posts/:id/report` | Flag inappropriate content | auth |
| PATCH | `/api/posts/:id/moderate` | Hide / pin / unpin / delete | mgmt_staff, admin |

### 7.4 OC Document Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/oc-documents` | Upload file-backed document (multipart) | oc_committee, mgmt_staff, admin |
| POST | `/api/oc-documents/link` | Publish link-backed document (Google Meet / Drive / Site) | oc_committee, mgmt_staff, admin |
| GET | `/api/oc-documents` | List documents (filterable by year, type) | auth |
| GET | `/api/oc-documents/:id` | Get document detail | auth |
| DELETE | `/api/oc-documents/:id` | Remove document | oc_committee, mgmt_staff, admin |

### 7.5 Notification Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/notifications` | Send targeted notification (creates DB row + Web Push fan-out) | mgmt_staff, admin |
| POST | `/api/notifications/:id/resend` | Re-push an existing notification (no new row) | mgmt_staff, admin |
| GET | `/api/notifications` | List current user's notifications (paginated, `unreadOnly`) | auth |
| GET | `/api/notifications/:id` | Single notification (compose prefill) | mgmt_staff, admin |
| PATCH | `/api/notifications/:id/read` | Mark one as read | auth |
| PATCH | `/api/notifications/read-all` | Mark all as read | auth |
| GET | `/api/push/vapid-key` | Public VAPID key for browser subscription | auth |
| POST | `/api/push/subscribe` | Register push subscription | auth |
| DELETE | `/api/push/subscribe` | Unregister push subscription | auth |
| POST | `/api/push/test` | Send a test push to the current user | auth |

### 7.6 User-Flats (Multi-Unit Owner) Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/users/me/flats` | List flats linked to the current user (primary + linked) | auth |
| POST | `/api/users/me/flats` | Link an additional flat (verified via flat password) | auth |
| DELETE | `/api/users/me/flats/:flatId` | Unlink a non-primary flat | auth |

### 7.7 Admin Endpoints

All admin endpoints require `admin` role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard counters (users, reports, posts, documents) |
| GET | `/api/admin/users` | List all users (paginated, filterable) |
| POST | `/api/admin/users` | Create user (resident with flat OR non-resident mgmt/committee/admin) |
| PATCH | `/api/admin/users/:id/role` | Update user role |
| PATCH | `/api/admin/users/:id/status` | Activate / deactivate user |
| GET | `/api/admin/flats` | List flats (paginated, filterable) |
| GET | `/api/admin/flats/blocks` | List distinct blocks (for filter dropdowns) |
| GET | `/api/admin/flats/export-csv` | Export flat list as CSV |
| POST | `/api/admin/flats` | Create new flat |
| PATCH | `/api/admin/flats/:id` | Edit flat |
| DELETE | `/api/admin/flats/:id` | Delete flat |
| POST | `/api/admin/flats/:id/reset-password` | Regenerate flat registration password (returned once, plaintext) |
| GET | `/api/admin/audit-logs` | View audit logs (paginated, filterable) |

---

## 8. Non-Functional Requirements / 非功能性需求

### 8.1 Performance / 性能
- Page load time < 3 seconds on 4G network
- API response time < 500ms for standard queries
- Support 500+ concurrent users per estate

### 8.2 Security / 安全
- All API endpoints require authentication (except auth routes)
- Role-based access control enforced at API level
- Passwords hashed with PBKDF2-HMAC-SHA256 at the Workers-maximum 100,000 iterations (Argon2id is unavailable in the Workers runtime)
- Rate limiting on auth endpoints to prevent brute-force attacks — **not yet implemented on the Worker**; see architecture.md §8.2
- Input sanitization to prevent XSS and SQL injection
- HTTPS enforced in production

### 8.3 PWA Requirements
- Installable on mobile and desktop via Add to Home Screen
- Offline-capable: cached static assets, queued actions sync when online
- Responsive design: mobile-first, supports 320px to 1920px viewports
- Service Worker handles push notifications in background

### 8.4 Accessibility / 無障礙
- WCAG 2.1 AA compliance
- Support for screen readers
- Minimum touch target size 44x44px on mobile

### 8.5 Data Privacy / 資料私隱
- Compliant with Hong Kong Personal Data (Privacy) Ordinance (Cap. 486)
- User data encrypted at rest and in transit
- Anonymous post identity only accessible by System Admin
- Data retention policy configurable by admin

---

## 9. Milestones / 開發里程碑

### Phase 1 — Foundation / 基礎建設
- Project setup (Vite + React + Fastify + PostgreSQL + Redis — since replaced, see Phase 7)
- Database schema design and migrations/seeds
- Authentication system with flat-based registration
- User role management

### Phase 2 — Core Communication / 核心溝通功能
- Incident report CRUD with status tracking
- File upload for report attachments
- Management dashboard for report handling

### Phase 3 — Community / 社區功能
- Discussion boards by block/floor
- Post creation with photo upload
- Anonymous posting mode
- Comment and reaction system
- Moderation tools

### Phase 4 — OC & Notifications / 法團及通知
- OC document upload and browsing
- In-app PDF viewer
- Push notification system (Web Push API)
- Targeted notification delivery
- In-app notification center

### Phase 5 — PWA & Polish / PWA 及優化
- Service Worker setup, offline support
- App manifest and installability
- Performance optimization
- Accessibility audit and fixes
- Security hardening and penetration testing

### Phase 6 — Post-Launch Iterations / 上線後迭代

Implemented after the initial 5-wave build:

- **Multi-unit owners** — `user_flats` join table; residents who own more than one flat link extras via `/profile/flats`. Discussion-board scoping resolves to every linked flat's block/floor.
- **Common-area report locations** — `location_block` / `location_floor` / `location_area` are now optional, supporting reports for shared facilities (lobbies, lifts, corridors).
- **Manual notification compose for mgmt** — dedicated `/notifications/compose` page with category, target, and reminder/re-push controls.
- **Auto-reopen on resident follow-up** — completed reports reopen when a resident comments; mgmt is notified; UI warns first.
- **Non-resident user creation** — admins can create mgmt/committee/admin accounts without assigning a flat.
- **OC committee read-only** — committee accounts cannot file tickets, comment, or author posts; they retain full read access plus reactions and post flags.
- **OC documents — link-backed** — beyond file uploads, OC committee can publish Google Meet / Drive / Site links for livestreams and recordings.
- **Admin user & flat management** — soft-delete users, reset passwords, unlink flats, flat CRUD with CSV export.

### Phase 7 — Cloudflare Cutover / 遷移至 Cloudflare

The entire backend was re-platformed onto Cloudflare with no change to the product surface:

- **Fastify → Hono on Workers** — one Worker serves the API *and* the SPA static assets.
- **PostgreSQL + Sequelize → D1 + Drizzle** — schema-first migrations generated by Drizzle Kit and applied by `wrangler`.
- **Redis → Durable Object (`SessionStore`)** — refresh-token hashes, push subscriptions, and reset tokens, sharded per user/token.
- **Local disk → R2** — uploads keyed `{entity}/{yyyy-mm}/{uuid}.{ext}` and served immutably.
- **Argon2id → PBKDF2-HMAC-SHA256** — Argon2 needs a wasm import the Workers runtime blocks.
- **Admin password → KV** — rotate with one `wrangler kv key put`, no redeploy or migration.
- **Password reset endpoints implemented** — token minting and consumption work; email/SMS delivery is still outstanding.
- **Docker / Traefik / GHCR retired** — replaced by `.github/workflows/deploy-cloudflare.yml`.

---

## Appendix A: Glossary / 詞彙表

| English | Chinese | Description |
|---------|---------|-------------|
| Estate | 屋苑 | A housing estate or residential complex |
| Block | 座 | A building within the estate |
| Floor | 樓層 | A floor level within a block |
| Flat / Unit | 單位 | An individual apartment unit |
| Resident | 業戶 | An owner or tenant of a flat |
| Owners' Corporation (OC) | 業主立案法團 | Legal entity formed by owners under Cap. 344 |
| Management Office | 管理處 | Property management company office |
| Incident Report | 事件報告 | A report submitted by a resident |
| Discussion Board | 討論板 | Community forum section |
| Push Notification | 推送通知 | Browser/device notification |
