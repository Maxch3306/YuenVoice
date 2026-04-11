# YUENVOICE — Sitemap

> Version: 1.0
> Last Updated: 2026-03-28
> Reference: [PRD.md](../PRD.md) | [architecture.md](../architecture.md)

---

## Route Map / 路由地圖

```
YUENVOICE
│
├── /login                              登入
├── /register                           註冊（單位密碼驗證）
├── /forgot-password                    忘記密碼
├── /reset-password?token=...           重設密碼
│
├── /                                   → Redirect to /reports
│
├── /reports                            事件報告列表（我的報告）
│   ├── /reports/new                    提交新報告
│   └── /reports/:id                    報告詳情 + 狀態追蹤
│
├── /discussion                         討論板列表
│   ├── /discussion/:boardId            帖文列表
│   ├── /discussion/:boardId/new        發佈新帖文
│   └── /discussion/post/:postId        帖文詳情 + 留言
│
├── /oc                                 法團文件列表
│   └── /oc/:id                         文件檢視（PDF 預覽）
│
├── /notifications                      通知中心
│
└── /admin                              管理後台（僅管理員）
    ├── /admin/users                    用戶管理
    ├── /admin/flats                    單位管理（註冊密碼）
    └── /admin/audit-logs               審計日誌
```

---

## Page Inventory / 頁面清單

### Auth Pages / 認證頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/login` | LoginPage | AuthLayout | Public | 電郵 + 密碼登入 |
| `/register` | RegisterPage | AuthLayout | Public | 三步驟註冊：選擇單位 → 驗證密碼 → 建立帳戶 |
| `/forgot-password` | ForgotPasswordPage | AuthLayout | Public | 輸入電郵請求重設密碼 |
| `/reset-password` | ResetPasswordPage | AuthLayout | Public | 透過 token 重設密碼 |

### Report Pages / 事件報告頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/reports` | ReportListPage | MainLayout | All authenticated | 我的事件報告列表，可篩選狀態及類型 |
| `/reports/new` | CreateReportPage | MainLayout | All authenticated | 提交維修 / 投訴 / 查詢報告，含圖片上載 |
| `/reports/:id` | ReportDetailPage | MainLayout | Owner / Mgmt / Admin | 報告詳情、狀態時間軸、附件、留言紀錄 |

### Discussion Pages / 討論頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/discussion` | BoardListPage | MainLayout | All authenticated | 討論板列表（全屋苑 + 各座） |
| `/discussion/:boardId` | PostListPage | MainLayout | All authenticated | 討論板內帖文列表，置頂帖優先 |
| `/discussion/:boardId/new` | CreatePostPage | MainLayout | All authenticated | 發佈帖文，支援圖片上載及匿名模式 |
| `/discussion/post/:postId` | PostDetailPage | MainLayout | All authenticated | 帖文全文、圖片、留言、讚好、舉報 |

### OC Document Pages / 法團文件頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/oc` | DocumentListPage | MainLayout | All authenticated | 法團文件列表，按年份及類型篩選 |
| `/oc/:id` | DocumentViewPage | MainLayout | All authenticated | 文件檢視（PDF 內嵌預覽）及下載 |

### Notification Pages / 通知頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/notifications` | NotificationCenterPage | MainLayout | All authenticated | 通知列表，已讀 / 未讀狀態，類別標籤 |

### Admin Pages / 管理頁面

| Route | Page | Layout | Access | Description |
|-------|------|--------|--------|-------------|
| `/admin` | DashboardPage | AdminLayout | Admin only | 統計概覽：用戶數、報告數、近期活動 |
| `/admin/users` | UserManagementPage | AdminLayout | Admin only | 用戶列表、角色變更、啟用 / 停用帳戶 |
| `/admin/flats` | FlatManagementPage | AdminLayout | Admin only | 單位列表、重設註冊密碼、註冊狀態管理 |
| `/admin/audit-logs` | AuditLogPage | AdminLayout | Admin only | 審計日誌查詢、篩選、詳情展開 |

---

## Layouts / 版面配置

### AuthLayout

```
┌─────────────────────────────────┐
│           YUENVOICE Logo        │
│                                 │
│     ┌───────────────────────┐   │
│     │                       │   │
│     │     Auth Form Card    │   │
│     │     (login/register)  │   │
│     │                       │   │
│     └───────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

Used by: `/login`, `/register`, `/forgot-password`, `/reset-password`

### MainLayout

```
┌─────────────────────────────────────────────┐
│  Logo    YUENVOICE       🔔(3)   👤 Menu   │  ← Header
├──────┬──────────────────────────────────────┤
│      │                                      │
│ Nav  │          Page Content                │
│      │          <Outlet />                  │
│      │                                      │
│      │                                      │
├──────┴──────────────────────────────────────┤
│  📋 Reports  💬 Discussion  📄 OC  🔔 Notif │  ← Bottom Nav (mobile)
└─────────────────────────────────────────────┘

Desktop: Sidebar nav on left
Mobile:  Bottom tab navigation, no sidebar
```

Used by: `/reports/*`, `/discussion/*`, `/oc/*`, `/notifications`

### AdminLayout

```
┌─────────────────────────────────────────────┐
│  Logo    YUENVOICE (Admin)   🔔   👤 Menu  │  ← Header
├──────────────┬──────────────────────────────┤
│              │                              │
│  Dashboard   │       Page Content           │
│  Users       │       <Outlet />             │
│  Flats       │                              │
│  Audit Logs  │                              │
│              │                              │
│  ← Back to   │                              │
│    main app  │                              │
├──────────────┴──────────────────────────────┤
└─────────────────────────────────────────────┘

Desktop: Always shows sidebar
Mobile:  Hamburger menu for admin nav
```

Used by: `/admin/*`

---

## Navigation Structure / 導航結構

### Bottom Navigation (Mobile) / 底部導航

| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| 📋 | 報告 | `/reports` | — |
| 💬 | 討論 | `/discussion` | — |
| 📄 | 法團 | `/oc` | — |
| 🔔 | 通知 | `/notifications` | Unread count |

### Sidebar Navigation (Desktop) / 側邊導航

| Label | Route | Visible to |
|-------|-------|------------|
| 事件報告 | `/reports` | All |
| 討論區 | `/discussion` | All |
| 法團文件 | `/oc` | All |
| 通知中心 | `/notifications` | All |
| 管理後台 | `/admin` | Admin only |

### Admin Sidebar / 管理後台側邊導航

| Label | Route |
|-------|-------|
| 儀表板 | `/admin` |
| 用戶管理 | `/admin/users` |
| 單位管理 | `/admin/flats` |
| 審計日誌 | `/admin/audit-logs` |
| ← 返回主頁 | `/reports` |

---

## User Flows / 用戶流程

### Flow 1: Registration / 註冊流程

```
/login
  │ click "註冊"
  ▼
/register
  │ Step 1: Select block + floor + unit
  │ Step 2: Enter flat registration password → validate
  │ Step 3: Name, email, phone, password
  │ Submit
  ▼
/reports (auto-redirect after successful registration)
```

### Flow 2: Submit Incident Report / 提交事件報告

```
/reports
  │ click "+" FAB
  ▼
/reports/new
  │ Fill form: title, type, description, location, photos
  │ Submit
  ▼
/reports/:id (redirect to created report detail)
```

### Flow 3: Report Status Tracking / 報告狀態追蹤

```
/reports
  │ click report card
  ▼
/reports/:id
  │ View status timeline: 待處理 → 跟進中 → 已完成
  │ View comments from management
  │ Add comment/reply
  ▼
(push notification received on status change)
```

### Flow 4: Discussion Post / 發佈討論帖文

```
/discussion
  │ click board card
  ▼
/discussion/:boardId
  │ click "+" FAB
  ▼
/discussion/:boardId/new
  │ Fill: title, body, photos, anonymous toggle
  │ Submit
  ▼
/discussion/post/:postId (redirect to created post)
```

### Flow 5: Management Send Notification / 管理處推送通知

```
/admin (or MainLayout for mgmt_staff)
  │ click "Send Notification"
  ▼
Notification form (dialog or page):
  │ Title, body, category (urgent/general/event)
  │ Target: all / block / floor
  │ Submit
  ▼
Push notification delivered to target residents
  │
  ▼
/notifications (residents view notification)
```

### Flow 6: OC Document Publish / 發佈法團文件

```
/oc
  │ click "Upload" (OC committee / admin only)
  ▼
Upload dialog:
  │ Title, type, year, description, file
  │ Submit
  ▼
/oc (new document appears in list)
  │ click document card
  ▼
/oc/:id (PDF viewer inline)
```

### Flow 7: Admin Password Reset / 管理員重設單位密碼

```
/admin/flats
  │ find flat in table
  │ click "重設密碼"
  ▼
Confirmation dialog: "確定重設此單位的註冊密碼？"
  │ confirm
  ▼
New password displayed (copy to clipboard)
  │ "新密碼: XXXXXX — 此密碼只會顯示一次"
```

---

## Access Control Summary / 存取控制摘要

| Route Group | Public | Resident | OC Committee | Mgmt Staff | Admin |
|-------------|--------|----------|-------------|------------|-------|
| `/login`, `/register` | Yes | — | — | — | — |
| `/reports/*` | — | Own only | Own only | All | All |
| `/discussion/*` | — | Yes | Yes | Yes | Yes |
| `/oc/*` (read) | — | Yes | Yes | Yes | Yes |
| `/oc/*` (write) | — | — | Yes | — | Yes |
| `/notifications` | — | Yes | Yes | Yes | Yes |
| `/admin/*` | — | — | — | — | Yes |

---

## Page Count Summary / 頁面數量

| Category | Count |
|----------|-------|
| Auth | 4 |
| Reports | 3 |
| Discussion | 4 |
| OC Documents | 2 |
| Notifications | 1 |
| Admin | 4 |
| **Total** | **18 pages** |
