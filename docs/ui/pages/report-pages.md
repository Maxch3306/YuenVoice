# Report Pages — UI Design / 事件報告頁面設計

> Reference: [MASTER.md](../../design-system/yuenvoice/MASTER.md) | [sitemap.md](../ui/sitemap.md)
> Layout: **MainLayout**
> Access: All authenticated users (detail: owner / mgmt / admin)

---

## 1. ReportListPage (`/reports`) / 事件報告列表

```
┌─────────────────────────────────────────────┐
│  Header                          🔔  👤     │
├─────────────────────────────────────────────┤
│                                             │
│  h1: 事件報告                                │
│                                             │
│  ┌─ Tabs ─────────────────────────────────┐ │
│  │ 全部 │ 待處理 │ 跟進中 │ 已完成         │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ Type Filter ──┐  ┌─ Search ─────────┐  │
│  │ 所有類型    ▼   │  │ 🔍 搜尋報告...   │  │
│  └─────────────────┘  └─────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ ┌────────┐                          │   │
│  │ │故障維修 │   水管漏水               │   │
│  │ └────────┘                          │   │
│  │ A座 12樓    ┌────────┐   2025-03-28 │   │
│  │             │ 待處理  │              │   │
│  │             └────────┘              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ ┌────┐                              │   │
│  │ │投訴│   鄰居深夜噪音               │   │
│  │ └────┘                              │   │
│  │ B座 8樓     ┌────────┐   2025-03-27 │   │
│  │             │ 跟進中  │              │   │
│  │             └────────┘              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ ┌────┐                              │   │
│  │ │查詢│   管理費查詢                  │   │
│  │ └────┘                              │   │
│  │ C座 3樓     ┌────────┐   2025-03-25 │   │
│  │             │ 已完成  │              │   │
│  │             └────────┘              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ← 1  2  3 →  (Pagination)                 │
│                                             │
│                              ┌───┐          │
│                              │ + │ ← FAB    │
│                              └───┘          │
│                                             │
├─────────────────────────────────────────────┤
│  Bottom Nav (mobile)                        │
└─────────────────────────────────────────────┘
```

### Report Card Component

```
┌──────────────────────────────────────────┐
│                                          │
│  ┌──────────┐                            │
│  │ 故障維修  │  ← Badge variant="outline" │
│  └──────────┘                            │
│                                          │
│  水管漏水 — 廚房水管嚴重漏水              │  ← title (font-medium) + excerpt
│                                          │
│  📍 A座 12樓              ┌────────┐     │
│  📅 2025-03-28            │ 待處理  │     │  ← Status badge (amber)
│                           └────────┘     │
│                                          │
└──────────────────────────────────────────┘

hover: shadow-sm transition-shadow
cursor: pointer → navigates to /reports/:id
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Filter tabs | `Tabs` + `TabsList` + `TabsTrigger` | Status filter |
| Type filter | `Select` | Dropdown: 所有類型 / 故障維修 / 投訴 / 查詢 |
| Search | `Input` | With search icon prefix |
| Report card | `Card` | Clickable, hover:shadow-sm |
| Type badge | `Badge variant="outline"` | Report type |
| Status badge | `Badge` | Custom colors per status |
| FAB | `Button` | `rounded-full h-14 w-14 shadow-lg` fixed bottom-right |
| Pagination | Custom | `← 1 2 3 →` buttons |
| Empty state | Custom | Illustration + "暫無事件報告" |
| Loading | `Skeleton` | 3 card-shaped skeletons |

---

## 2. CreateReportPage (`/reports/new`) / 提交新報告

```
┌─────────────────────────────────────────────┐
│  ← 返回           提交新報告                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │  標題 (Title)                        │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │                              │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  類型 (Type)                         │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 選擇類型                 ▼   │    │   │
│  │  └──────────────────────────────┘    │   │
│  │  Options: 故障維修 / 投訴 / 查詢      │   │
│  │                                      │   │
│  │  詳細描述 (Description)              │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │                              │    │   │
│  │  │                              │    │   │
│  │  │                              │    │   │
│  │  │                     0/5000   │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  位置 (Location)                     │   │
│  │  ┌──────────┐ ┌──────────┐          │   │
│  │  │ 座    ▼  │ │ 樓層  ▼  │          │   │
│  │  └──────────┘ └──────────┘          │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 具體位置（選填）              │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  附件 (Attachments)                  │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │                              │    │   │
│  │  │   📷 點擊或拖曳上載圖片       │    │   │
│  │  │   最多5張，每張不超過10MB      │    │   │
│  │  │                              │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  ┌─ Thumbnails ───────────────┐      │   │
│  │  │ [img1] [img2] [img3]  [+]  │      │   │
│  │  └────────────────────────────┘      │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │          提交報告             │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Back button | `Button variant="ghost"` | With arrow icon |
| Title input | `Input` | Max 200 chars |
| Type select | `Select` | 3 options |
| Description | `Textarea` | Max 5000 chars, char counter |
| Block/Floor | `Select` × 2 | Inline row on desktop |
| Area input | `Input` | Optional, placeholder text |
| Upload zone | Custom | Dashed border, click/drag, `border-dashed border-2 border-muted-foreground/25` |
| Thumbnails | Custom | Grid of preview images with X remove button |
| Submit | `Button variant="default"` | `w-full h-11`, loading spinner on submit |

---

## 3. ReportDetailPage (`/reports/:id`) / 報告詳情

```
┌─────────────────────────────────────────────┐
│  ← 返回           報告詳情                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │  ┌──────────┐  ┌────────┐            │   │
│  │  │ 故障維修  │  │ 跟進中  │            │   │
│  │  └──────────┘  └────────┘            │   │
│  │                                      │   │
│  │  h2: 水管漏水                         │   │
│  │  📅 2025-03-28 提交                   │   │
│  │  📍 A座 12樓 廚房                     │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Status Timeline ────────────────────┐   │
│  │                                      │   │
│  │  ● 待處理     2025-03-28 10:30      │   │
│  │  │            報告已提交              │   │
│  │  │                                   │   │
│  │  ● 跟進中     2025-03-29 09:15      │   │
│  │  │            管理處已安排維修        │   │
│  │  │                                   │   │
│  │  ○ 已完成     —                      │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Description ────────────────────────┐   │
│  │                                      │   │
│  │  廚房水管嚴重漏水，已用毛巾暫時       │   │
│  │  處理，但水量頗大，請儘快安排維修。   │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Attachments ────────────────────────┐   │
│  │                                      │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐       │   │
│  │  │ img1 │  │ img2 │  │ img3 │       │   │
│  │  └──────┘  └──────┘  └──────┘       │   │
│  │  (click to enlarge — lightbox)       │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Mgmt Controls (mgmt/admin only) ───┐   │
│  │                                      │   │
│  │  ┌────────────┐  ┌────────────┐      │   │
│  │  │  開始跟進   │  │  標記完成   │      │   │
│  │  └────────────┘  └────────────┘      │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Comments ───────────────────────────┐   │
│  │                                      │   │
│  │  h3: 留言紀錄 (3)                    │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 管理處職員  2025-03-29 09:15 │    │   │
│  │  │ 已安排水喉師傅明天上午到場    │    │   │
│  │  │ 檢查及維修。                  │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 🔒 內部備註  (mgmt only)      │    │   │
│  │  │ bg-muted/50 + border-dashed  │    │   │
│  │  │ 水喉師傅聯絡電話：9123-4567  │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 陳大文  2025-03-29 10:00     │    │   │
│  │  │ 好的，謝謝跟進！              │    │   │
│  │  └──────────────────────────────┘    │   │
│  │                                      │   │
│  │  ── Add Comment ──────────────────   │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │ 輸入留言...                   │    │   │
│  │  └──────────────────────────────┘    │   │
│  │  □ 內部備註 (mgmt only)   [發送]     │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Status Timeline Component

```
  ● ── Active step (bg-primary, text-primary-foreground)
  │    Vertical line (border-l-2 border-primary)
  │
  ● ── Completed step (bg-primary)
  │
  ○ ── Pending step (border-2 border-muted-foreground/30)
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Status badges | `Badge` | Custom status colors |
| Timeline | Custom | Vertical dot + line + text |
| Image grid | Custom | 3-col grid, click opens `Dialog` lightbox |
| Mgmt buttons | `Button variant="outline"` | Conditional on role |
| Comment card | `Card` or `div` | Author + timestamp + content |
| Internal note | `div` | `bg-muted/50 border-l-4 border-dashed` with lock icon |
| Comment input | `Textarea` + `Button` | Inline form |
| Internal toggle | `Checkbox` | "內部備註" label, mgmt only |
