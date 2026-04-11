# Notification Center — UI Design / 通知中心頁面設計

> Reference: [MASTER.md](../../design-system/yuenvoice/MASTER.md) | [sitemap.md](../ui/sitemap.md)
> Layout: **MainLayout**
> Access: All authenticated users

---

## NotificationCenterPage (`/notifications`) / 通知中心

```
┌─────────────────────────────────────────────┐
│  Header                          🔔  👤     │
├─────────────────────────────────────────────┤
│                                             │
│  h1: 通知中心                                │
│                                             │
│  ┌─ Controls ───────────────────────────┐   │
│  │                                      │   │
│  │  ┌──────────────┐    全部標為已讀 ←   │   │
│  │  │ □ 只顯示未讀  │    text link       │   │
│  │  └──────────────┘                    │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Unread ─────────────────────────────┐   │
│  │  ●                                   │   │
│  │  ┌────────┐                          │   │
│  │  │  緊急  │   停水通知                │   │
│  │  └────────┘                          │   │
│  │  A座因水管維修將於今日下午2時至       │   │
│  │  5時暫停供水，請預先儲水。           │   │
│  │                                      │   │
│  │  管理處  ·  10 分鐘前                │   │
│  │                                      │   │
│  │  border-l-4 border-primary           │   │
│  │  bg-accent/30 (unread highlight)     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Unread ─────────────────────────────┐   │
│  │  ●                                   │   │
│  │  ┌────────┐                          │   │
│  │  │  一般  │   事件報告狀態更新         │   │
│  │  └────────┘                          │   │
│  │  你的報告「水管漏水」已更新為         │   │
│  │  跟進中。                            │   │
│  │                                      │   │
│  │  系統  ·  2 小時前                   │   │
│  │                                      │   │
│  │  border-l-4 border-primary           │   │
│  │  bg-accent/30                        │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Read ───────────────────────────────┐   │
│  │                                      │   │
│  │  ┌────────┐                          │   │
│  │  │  活動  │   中秋節聯歡晚會          │   │
│  │  └────────┘                          │   │
│  │  屋苑將於9月15日舉辦中秋節聯歡       │   │
│  │  晚會，歡迎全體業戶參加。            │   │
│  │                                      │   │
│  │  管理處  ·  1 天前                   │   │
│  │                                      │   │
│  │  (no border-l, no bg highlight)      │   │
│  │  text-muted-foreground               │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Read ───────────────────────────────┐   │
│  │                                      │   │
│  │  ┌────────┐                          │   │
│  │  │  一般  │   新法團文件              │   │
│  │  └────────┘                          │   │
│  │  已發佈新文件：2025年度財務報表       │   │
│  │                                      │   │
│  │  系統  ·  3 天前                     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ── Load more ───────────────────────────   │
│  ┌──────────────────────────────────────┐   │
│  │          載入更多                     │   │
│  └──────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  Bottom Nav                                 │
└─────────────────────────────────────────────┘

── Empty state ────────────────────────────────
│                                             │
│       (Bell icon, large, muted)             │
│                                             │
│       暫無通知                               │
│       text-muted-foreground                 │
│                                             │
```

---

## Notification Bell Component (in Header)

```
Desktop — dropdown on click:
┌─────────────────────────────────┐
│  🔔 ← bell icon with badge     │
│  ┌3┐  ← red dot, absolute      │
│                                 │
│  ▼ Dropdown (on click):         │
│  ┌───────────────────────────┐  │
│  │  通知                     │  │
│  │  ─────────────────────    │  │
│  │  ● 停水通知   10分鐘前    │  │
│  │  ● 報告狀態更新  2小時前  │  │
│  │  ● 新法團文件   3天前     │  │
│  │  ─────────────────────    │  │
│  │  查看全部 →               │  │
│  └───────────────────────────┘  │
│                                 │
│  Popover component              │
│  max-h-80 overflow-y-auto       │
│  w-80                           │
└─────────────────────────────────┘

Mobile — tap navigates to /notifications
```

---

## Notification Card Component

### Unread State
```
┌──────────────────────────────────────────┐
│  ●  ← unread dot (bg-primary, 8px)      │
│                                          │
│  ┌────────┐                              │
│  │  緊急  │  ← category badge (red)      │
│  └────────┘                              │
│                                          │
│  停水通知                                │  ← title, font-medium
│  A座因水管維修將於今日下午2時至           │  ← body, text-sm
│  5時暫停供水...                          │
│                                          │
│  管理處  ·  10 分鐘前                    │  ← sender + relative time
│                                          │
│  Styling:                                │
│  - border-l-4 border-primary             │
│  - bg-accent/30                          │
│  - cursor-pointer                        │
└──────────────────────────────────────────┘
```

### Read State
```
┌──────────────────────────────────────────┐
│                                          │
│  ┌────────┐                              │
│  │  活動  │  ← category badge (green)    │
│  └────────┘                              │
│                                          │
│  中秋節聯歡晚會                          │  ← title, font-normal
│  屋苑將於9月15日舉辦中秋節聯歡...         │  ← body, text-sm text-muted-foreground
│                                          │
│  管理處  ·  1 天前                        │
│                                          │
│  Styling:                                │
│  - no border-l                           │
│  - bg-card (default)                     │
│  - text-muted-foreground                 │
└──────────────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Unread filter | `Checkbox` + `Label` | "只顯示未讀" toggle |
| Mark all read | `Button variant="link"` | `text-sm` |
| Notification card | `div` | Clickable, marks as read on click |
| Category badge | `Badge` | Custom colors: 緊急=red, 一般=blue, 活動=green |
| Unread dot | `span` | `h-2 w-2 rounded-full bg-primary` |
| Load more | `Button variant="outline"` | `w-full` |
| Bell dropdown | `Popover` | Desktop only, shows 5 latest |
| Badge count | `span` | `absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5` |
| Empty state | Custom | Large bell icon + text |
