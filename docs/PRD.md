# YUENVOICE — Product Requirements Document

> Version: 1.0
> Last Updated: 2026-03-28

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
| Frontend | Vite + React 18 + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend | Fastify (Node.js) |
| Database | PostgreSQL |
| ORM / Migrations / Seeds | Sequelize |
| Cache & Realtime | Redis (caching, pub/sub) |
| Push Notifications | Web Push API (VAPID) |
| PWA | Service Worker + Web App Manifest |
| File Storage | Local filesystem or S3-compatible object storage |
| Authentication | JWT (access + refresh tokens) |

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

| Feature | Resident | OC Committee | Mgmt Staff | Admin |
|---------|----------|-------------|------------|-------|
| Submit incident report | Yes | Yes | Yes | Yes |
| View own reports | Yes | Yes | Yes | Yes |
| View all reports | — | — | Yes | Yes |
| Update report status | — | — | Yes | Yes |
| Create discussion post | Yes | Yes | Yes | Yes |
| Post anonymously | Yes | Yes | — | — |
| Moderate discussions | — | — | Yes | Yes |
| View OC documents | Yes | Yes | Yes | Yes |
| Publish OC documents | — | Yes | — | Yes |
| Send push notifications | — | — | Yes | Yes |
| Manage flat passwords | — | — | Yes | Yes |
| Manage users / roles | — | — | — | Yes |
| System configuration | — | — | — | Yes |
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

**Additional Features:**

- Management can add internal notes (not visible to reporter)
- Management can add reply messages visible to the reporter
- Residents receive push notification on status changes
- Report history searchable and filterable by status, type, date

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

- Web Push API with VAPID keys for browser-based push
- Redis pub/sub for real-time in-app notification delivery
- Notification center in-app with read/unread status
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
├── flat_id (FK → Flat)
├── role (enum: resident, oc_committee, mgmt_staff, admin)
├── is_active
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
├── type (enum: meeting_minutes, financial_statement, resolution, notice)
├── title
├── description
├── file_path
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

### 7.1 Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with flat password |
| POST | `/api/auth/login` | Login, returns JWT pair |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### 7.2 Incident Report Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports` | Create incident report |
| GET | `/api/reports` | List reports (filtered) |
| GET | `/api/reports/:id` | Get report detail |
| PATCH | `/api/reports/:id/status` | Update report status (mgmt) |
| POST | `/api/reports/:id/comments` | Add comment / reply |
| POST | `/api/reports/:id/attachments` | Upload attachment |

### 7.3 Discussion Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/boards` | List discussion boards |
| GET | `/api/boards/:id/posts` | List posts in board |
| POST | `/api/boards/:id/posts` | Create post (with photos) |
| GET | `/api/posts/:id` | Get post detail |
| POST | `/api/posts/:id/comments` | Add comment |
| POST | `/api/posts/:id/reactions` | Add/remove reaction |
| POST | `/api/posts/:id/report` | Flag post |
| PATCH | `/api/posts/:id/moderate` | Hide/pin post (mgmt) |

### 7.4 OC Document Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/oc-documents` | Upload document (OC/admin) |
| GET | `/api/oc-documents` | List documents (filtered) |
| GET | `/api/oc-documents/:id` | Get document detail |
| DELETE | `/api/oc-documents/:id` | Remove document (OC/admin) |

### 7.5 Notification Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications` | Send notification (mgmt) |
| GET | `/api/notifications` | List user notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| POST | `/api/push/subscribe` | Register push subscription |
| DELETE | `/api/push/subscribe` | Unregister push subscription |

### 7.6 Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id/role` | Update user role |
| PATCH | `/api/admin/users/:id/status` | Activate/deactivate user |
| GET | `/api/admin/flats` | List all flats |
| POST | `/api/admin/flats/:id/reset-password` | Regenerate flat password |
| GET | `/api/admin/audit-logs` | View audit logs |

---

## 8. Non-Functional Requirements / 非功能性需求

### 8.1 Performance / 性能
- Page load time < 3 seconds on 4G network
- API response time < 500ms for standard queries
- Support 500+ concurrent users per estate

### 8.2 Security / 安全
- All API endpoints require authentication (except auth routes)
- Role-based access control enforced at API level
- Passwords hashed with bcrypt (cost factor 12)
- Rate limiting on auth endpoints to prevent brute-force attacks
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
- Project setup (Vite + React + Fastify + PostgreSQL + Redis)
- Database schema design and Sequelize migrations/seeds
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
