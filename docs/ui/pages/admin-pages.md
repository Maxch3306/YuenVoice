# Admin Pages — UI Design / 管理頁面設計

> Reference: [MASTER.md](../../design-system/yuenvoice/MASTER.md) | [sitemap.md](../ui/sitemap.md)
> Layout: **AdminLayout** (sidebar always visible on desktop, hamburger on mobile)
> Access: Admin only

---

## 1. DashboardPage (`/admin`) / 管理儀表板

```
┌─────────────────────────────────────────────────────┐
│  Header (Admin)                        🔔  👤       │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  儀表板  ●   │  h1: 管理儀表板                       │
│  用戶管理    │                                      │
│  單位管理    │  ┌──────────┐ ┌──────────┐            │
│  審計日誌    │  │          │ │          │            │
│              │  │  👥 156  │ │  📋 23   │            │
│  ──────────  │  │ 註冊用戶  │ │ 待處理報告│            │
│  ← 返回主頁  │  │          │ │          │            │
│              │  └──────────┘ └──────────┘            │
│              │                                      │
│              │  ┌──────────┐ ┌──────────┐            │
│              │  │          │ │          │            │
│              │  │  💬 45   │ │  📄 12   │            │
│              │  │ 本週帖文  │ │ 法團文件  │            │
│              │  │          │ │          │            │
│              │  └──────────┘ └──────────┘            │
│              │                                      │
│              │  ┌─ Recent Activity ──────────────┐   │
│              │  │                                │   │
│              │  │  h3: 近期活動                   │   │
│              │  │                                │   │
│              │  │  • 管理員更新了用戶角色          │   │
│              │  │    王小明 → oc_committee         │   │
│              │  │    5 分鐘前                     │   │
│              │  │                                │   │
│              │  │  • 管理處更新報告狀態            │   │
│              │  │    水管漏水 → 已完成             │   │
│              │  │    1 小時前                     │   │
│              │  │                                │   │
│              │  │  • 新用戶註冊                   │   │
│              │  │    陳大文 (A座 12樓 3號)         │   │
│              │  │    3 小時前                     │   │
│              │  │                                │   │
│              │  │  • 法團文件發佈                  │   │
│              │  │    第十二次業主會議記錄           │   │
│              │  │    1 天前                       │   │
│              │  │                                │   │
│              │  └────────────────────────────────┘   │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
└─────────────────────────────────────────────────────┘
```

### Stat Card Component

```
┌───────────────────────┐
│                       │
│  icon (HugeIcon)      │  ← text-muted-foreground, 24px
│                       │
│  156                  │  ← text-3xl font-bold
│  註冊用戶             │  ← text-sm text-muted-foreground
│                       │
└───────────────────────┘

Card component, p-6
2-col grid on mobile, 4-col on desktop
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Stat cards | `Card` | 2×2 grid mobile, 4×1 desktop |
| Activity feed | `Card` | List with bullet + description + time |
| Activity item | `div` | `border-b last:border-0 py-3` |
| Admin sidebar | shadcn `Sidebar` | Fixed items + "返回主頁" link |

---

## 2. UserManagementPage (`/admin/users`) / 用戶管理

```
┌──────────────┬──────────────────────────────────────┐
│  Admin       │                                      │
│  Sidebar     │  h1: 用戶管理                         │
│              │                                      │
│              │  ┌─ Controls ────────────────────┐    │
│              │  │                                │    │
│              │  │  ┌──────────────┐ ┌──────────┐ │    │
│              │  │  │ 🔍 搜尋用戶... │ │ 角色  ▼ │ │    │
│              │  │  └──────────────┘ └──────────┘ │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ┌─ Table ───────────────────────┐    │
│              │  │                                │    │
│              │  │ 姓名    │ 電郵    │ 單位  │角色│狀態│    │
│              │  │─────────┼────────┼──────┼────┼────│    │
│              │  │ 陳大文  │chen@.. │A-12-3│業戶│ ✓  │    │
│              │  │         │        │      │ ▼  │    │    │
│              │  │─────────┼────────┼──────┼────┼────│    │
│              │  │ 王小明  │wong@.. │B-8-1 │委員│ ✓  │    │
│              │  │         │        │      │ ▼  │    │    │
│              │  │─────────┼────────┼──────┼────┼────│    │
│              │  │ 李職員  │lee@..  │ —    │管理│ ✓  │    │
│              │  │         │        │      │ ▼  │    │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ← 1  2  3  4  5 →                   │
│              │                                      │
└──────────────┴──────────────────────────────────────┘

Mobile: Cards instead of table (stacked layout)
```

### Role Change Flow

```
Click role dropdown on row:
┌──────────────────┐
│ 業戶 (Resident)  │ ← current, checked
│ 委員 (OC)        │
│ 管理 (Mgmt)      │
│ 管理員 (Admin)    │
└──────────────────┘

→ Triggers confirmation dialog:

┌──────────────────────────────────┐
│  h3: 確定更改用戶角色？            │
│                                  │
│  用戶: 陳大文                     │
│  由: 業戶 → 委員                  │
│                                  │
│  [取消]              [確定更改]   │
└──────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Search | `Input` | With search icon |
| Role filter | `Select` | All / 業戶 / 委員 / 管理 / 管理員 |
| Data table | `Table` | Desktop: full table. Mobile: card stack |
| Role dropdown | `Select` | Inline per row, triggers confirmation |
| Status toggle | `Switch` | Active/inactive per row |
| Confirmation | `AlertDialog` | Shows user name + role change |
| Pagination | Custom | Number buttons |

---

## 3. FlatManagementPage (`/admin/flats`) / 單位管理

```
┌──────────────┬──────────────────────────────────────┐
│  Admin       │                                      │
│  Sidebar     │  h1: 單位管理                         │
│              │                                      │
│              │  ┌─ Controls ────────────────────┐    │
│              │  │                                │    │
│              │  │  ┌──────────┐ ┌──────────────┐ │    │
│              │  │  │ 座   ▼  │ │ 🔍 搜尋單位... │ │    │
│              │  │  └──────────┘ └──────────────┘ │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ┌─ Table ───────────────────────┐    │
│              │  │                                │    │
│              │  │ 座│樓層│單位│住戶數│註冊狀態│操作│    │
│              │  │──┼────┼────┼──────┼────────┼────│    │
│              │  │A │ 1  │ 1  │  2   │  開放  │ ⟳ │    │
│              │  │A │ 1  │ 2  │  0   │  開放  │ ⟳ │    │
│              │  │A │ 1  │ 3  │  1   │  關閉  │ ⟳ │    │
│              │  │A │ 1  │ 4  │  3   │  開放  │ ⟳ │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ← 1  2  3 ... 24 →                  │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Reset Password Flow

```
Click ⟳ (reset) button:

┌──────────────────────────────────┐
│  h3: 確定重設此單位的註冊密碼？    │
│                                  │
│  單位: A座 1樓 1號                │
│  現有住戶: 2 人                   │
│                                  │
│  ⚠ 重設密碼不會影響已註冊的用戶   │
│                                  │
│  [取消]              [確定重設]   │
└──────────────────────────────────┘

→ On confirm:

┌──────────────────────────────────┐
│  ✓ 密碼已重設                     │
│                                  │
│  新密碼:                          │
│  ┌──────────────────────────┐    │
│  │  XK8m-2pQn-vR4j    [📋]  │    │
│  └──────────────────────────┘    │
│  (bg-muted, monospace, copy btn) │
│                                  │
│  ⚠ 此密碼只會顯示一次，           │
│    請記下並交予相關業戶。          │
│                                  │
│                        [完成]    │
└──────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Block filter | `Select` | A / B / C / 全部 |
| Search | `Input` | Search by unit number |
| Data table | `Table` | Block, floor, unit, resident count, status, actions |
| Registration status | `Badge` | 開放=green, 關閉=red |
| Reset button | `Button variant="ghost" size="icon"` | Refresh icon |
| Confirm dialog | `AlertDialog` | Unit info + warning |
| Password display | `Dialog` | Monospace font, copy button, warning text |
| Copy button | `Button variant="ghost" size="icon"` | Clipboard icon, toast on copy |

---

## 4. AuditLogPage (`/admin/audit-logs`) / 審計日誌

```
┌──────────────┬──────────────────────────────────────┐
│  Admin       │                                      │
│  Sidebar     │  h1: 審計日誌                         │
│              │                                      │
│              │  ┌─ Filters ─────────────────────┐    │
│              │  │                                │    │
│              │  │  ┌──────────────┐ ┌──────────┐ │    │
│              │  │  │ 🔍 搜尋用戶... │ │ 操作  ▼ │ │    │
│              │  │  └──────────────┘ └──────────┘ │    │
│              │  │                                │    │
│              │  │  ┌──────────┐ ┌──────────────┐ │    │
│              │  │  │ 類型  ▼  │ │ 📅 日期範圍   │ │    │
│              │  │  └──────────┘ └──────────────┘ │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ┌─ Table ───────────────────────┐    │
│              │  │                                │    │
│              │  │ 時間     │用戶  │操作   │類型│詳情│    │
│              │  │──────────┼─────┼──────┼────┼────│    │
│              │  │3/28 10:30│管理員│角色更新│User│ ▶ │    │
│              │  │──────────┼─────┼──────┼────┼────│    │
│              │  │  ▼ Expanded detail:             │    │
│              │  │  ┌────────────────────────────┐ │    │
│              │  │  │ {                          │ │    │
│              │  │  │   "old_role": "resident",  │ │    │
│              │  │  │   "new_role": "oc_committee"│ │    │
│              │  │  │ }                          │ │    │
│              │  │  └────────────────────────────┘ │    │
│              │  │──────────┼─────┼──────┼────┼────│    │
│              │  │3/28 09:15│管理處│狀態更新│Report│▶│    │
│              │  │──────────┼─────┼──────┼────┼────│    │
│              │  │3/27 16:00│管理員│密碼重設│Flat│ ▶ │    │
│              │  │                                │    │
│              │  └────────────────────────────────┘    │
│              │                                      │
│              │  ← 1  2  3 ... 10 →                  │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| User search | `Input` | Filter by name/email |
| Action filter | `Select` | All / 角色更新 / 狀態更新 / 密碼重設 / 文件刪除 / 帖文管理 |
| Entity type filter | `Select` | All / User / Report / Flat / Post / Document |
| Date range | Custom or `Popover` with date pickers | Start + end date |
| Data table | `Table` | Timestamp, user, action, entity type, expand toggle |
| Expand toggle | `Button variant="ghost" size="icon"` | Chevron icon, toggles row |
| Metadata display | `pre` | `bg-muted rounded-md p-3 text-xs font-mono` — formatted JSON |
| Pagination | Custom | Number buttons + prev/next |
