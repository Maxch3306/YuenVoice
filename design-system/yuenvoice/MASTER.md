# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** YUENVOICE — 屋苑通訊平台
**Generated:** 2026-03-28
**Category:** Community / Property Management Platform

---

## shadcn/ui Preset

```
Preset:       b6FmLbsX4
Style:        Maia
Base Color:   Olive
Theme:        Orange
Chart Color:  Yellow
Heading Font: JetBrains Mono
Body Font:    JetBrains Mono
Icon Library: HugeIcons
Radius:       Medium
Menu:         Default / Translucent
Menu Accent:  Subtle
```

**Init command:**

```bash
pnpm dlx shadcn@latest init --preset b6FmLbsX4 --template vite --rtl
```

---

## Global Rules

### Design Philosophy

YUENVOICE is a **bilingual (EN + 繁體中文) communication platform** for Hong Kong housing estate residents, the Owners' Corporation, and property management office. The design must:

- **Feel trustworthy and professional** — residents trust it for official communications
- **Be accessible to all ages** — elderly residents to young families
- **Prioritize readability** — especially for Traditional Chinese text
- **Work mobile-first** — most residents will use phones
- **Use flat, clean design** — fast performance, WCAG AAA accessible

### Style

**Style:** Maia (Flat Design variant)

- Olive-based neutral tones with orange accent
- Clean, modern, minimalist aesthetic
- Translucent menu with subtle accents
- Medium border radius for friendly feel
- Icon-heavy navigation (HugeIcons library)
- Clean transitions (150-200ms ease)
- Performance: Excellent | Accessibility: WCAG AAA

### Color Palette

Based on shadcn Maia style — **Olive base + Orange theme**.

The preset generates CSS variables automatically. Use `bg-primary`, `text-primary`, etc. in Tailwind.

| Role | CSS Variable | Tailwind Class | Usage |
|------|-------------|----------------|-------|
| Primary | `--primary` | `bg-primary` | Headers, nav, primary actions |
| Primary Foreground | `--primary-foreground` | `text-primary-foreground` | Text on primary bg |
| Secondary | `--secondary` | `bg-secondary` | Subtle backgrounds, secondary actions |
| Accent | `--accent` | `bg-accent` | Hover states, highlights |
| Background | `--background` | `bg-background` | Page background |
| Card | `--card` | `bg-card` | Card surfaces |
| Muted | `--muted` | `bg-muted` | Disabled states, subtle fills |
| Muted Foreground | `--muted-foreground` | `text-muted-foreground` | Secondary text, timestamps |
| Border | `--border` | `border-border` | Card borders, dividers |
| Destructive | `--destructive` | `bg-destructive` | Delete actions, errors |
| Chart 1-5 | `--chart-1` to `--chart-5` | — | Chart/data visualization (yellow-based) |

**Important:** Use the shadcn CSS variable classes (`bg-primary`, `text-muted-foreground`, etc.) — do NOT hardcode hex values. The preset handles light/dark mode automatically.

**Semantic Status Colors (custom, in addition to preset):**

| Status | BG Class | Text Class | Usage |
|--------|----------|------------|-------|
| Pending / 待處理 | `bg-amber-100` | `text-amber-800` | Report pending |
| In Progress / 跟進中 | `bg-blue-100` | `text-blue-800` | Report in progress |
| Completed / 已完成 | `bg-green-100` | `text-green-800` | Report completed |

**Notification Category Colors (custom):**

| Category | BG Class | Text Class | Usage |
|----------|----------|------------|-------|
| Urgent / 緊急 | `bg-red-100` | `text-red-800` | Emergency notices |
| General / 一般 | `bg-blue-100` | `text-blue-800` | Standard updates |
| Event / 活動 | `bg-green-100` | `text-green-800` | Community events |

### Typography

**Heading + Body font:** JetBrains Mono (monospace, set by preset)
**CJK fallback:** Noto Sans HK for Traditional Chinese characters

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Noto+Sans+HK:wght@400;500;700&display=swap');
```

**Tailwind config (extend preset):**

```typescript
fontFamily: {
  mono: ['"JetBrains Mono"', '"Noto Sans HK"', 'monospace'],
  sans: ['"Noto Sans HK"', '"JetBrains Mono"', 'system-ui', 'sans-serif'],
}
```

**Usage strategy:**
- JetBrains Mono: headings, navigation labels, badges, buttons, metadata (English-dominant)
- Noto Sans HK: Chinese body text, long-form descriptions, form labels
- The preset sets JetBrains Mono as default — add `font-sans` class on CJK-heavy content blocks for readability

**Type Scale (mobile-first):**

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| H1 | `text-2xl` (24px) | 700 | 1.3 | Page titles |
| H2 | `text-xl` (20px) | 600 | 1.35 | Section headings |
| H3 | `text-lg` (18px) | 600 | 1.4 | Card titles |
| Body | `text-base` (16px) | 400 | 1.6 | Default text |
| Small | `text-sm` (14px) | 400 | 1.5 | Timestamps, metadata |
| Caption | `text-xs` (12px) | 500 | 1.4 | Badges, labels |

**CJK-specific rules:**

- Body line-height `1.6` minimum (CJK text needs more vertical space)
- Never go below `14px` for Chinese text
- Use `font-weight: 400` for Chinese body (300 is too thin for CJK)
- `letter-spacing: 0.02em` for Chinese body text readability
- Use `font-sans` class (Noto Sans HK) for blocks with primarily Chinese content

### Icon Library

**HugeIcons** — set by shadcn preset.

```bash
# Install HugeIcons React package
pnpm add hugeicons-react
```

```tsx
import { Home01Icon, Notification01Icon, MessageEdit01Icon } from 'hugeicons-react';

<Home01Icon size={24} />
<Notification01Icon size={24} />
```

- Use HugeIcons consistently throughout the app
- Do NOT mix with Lucide or other icon libraries
- Size: `20px` for inline, `24px` for navigation, `32px` for empty states

### Spacing Variables

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-xs` | `4px` | `p-1` | Tight gaps, badge padding |
| `--space-sm` | `8px` | `p-2` | Icon gaps, inline spacing |
| `--space-md` | `16px` | `p-4` | Standard card padding |
| `--space-lg` | `24px` | `p-6` | Section padding |
| `--space-xl` | `32px` | `p-8` | Large section gaps |
| `--space-2xl` | `48px` | `py-12` | Page section margins |

### Border Radius

**Medium** radius (set by preset via `--radius` CSS variable):

- Cards: `rounded-lg` (8px)
- Buttons: `rounded-md` (6px)
- Badges: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)
- Modals: `rounded-xl` (12px)

### Shadow Depths

Flat design — use shadows **sparingly**, only for elevation hierarchy:

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, tooltips |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, floating nav |

---

## Component Specs

### Buttons

Use shadcn/ui Button component. The preset applies Maia styling automatically.

```tsx
// Primary action (submit, confirm)
<Button variant="default">提交報告</Button>  // uses --primary

// Secondary action (cancel, back)
<Button variant="outline">取消</Button>  // border + text

// Danger action (delete, deactivate)
<Button variant="destructive">刪除</Button>  // uses --destructive

// Ghost action (in-card actions)
<Button variant="ghost" size="sm">查看更多</Button>
```

- Minimum height: `44px` (touch target)
- Loading state: disable + show spinner icon
- Transitions: `150ms ease` on background/opacity
- Always `cursor-pointer`

### Cards

```tsx
// Standard content card — use shadcn Card, preset handles styling
<Card className="hover:shadow-sm transition-shadow duration-150 cursor-pointer">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

- Preset handles: bg, border, border-radius
- No shadow at rest (flat design), subtle shadow on hover
- Transition: `duration-150`

### Badges / Status Tags

```tsx
// Status badges (custom colors, not preset-controlled)
<Badge className="bg-amber-100 text-amber-800">待處理</Badge>
<Badge className="bg-blue-100 text-blue-800">跟進中</Badge>
<Badge className="bg-green-100 text-green-800">已完成</Badge>

// Category badges
<Badge className="bg-red-100 text-red-800">緊急</Badge>
<Badge className="bg-blue-100 text-blue-800">一般</Badge>
<Badge className="bg-green-100 text-green-800">活動</Badge>

// Type badges (use preset outline variant)
<Badge variant="outline">故障維修</Badge>
<Badge variant="outline">投訴</Badge>
<Badge variant="outline">查詢</Badge>
```

### Form Inputs

Use shadcn/ui Input, Select, Textarea. Preset applies Maia styling.

- Min font size: `16px` (prevents iOS zoom on focus)
- Focus ring: handled by preset (orange accent)
- Error state: `border-destructive ring-destructive/20`
- Labels always visible (no floating labels — CJK readability)
- Error messages: `text-destructive text-sm` below input

### Navigation

**Bottom nav (mobile):**

- Fixed bottom, `h-16` (64px)
- 4 items: Reports, Discussion, OC Docs, Notifications
- Use HugeIcons for nav icons
- Active: `text-primary`, inactive: `text-muted-foreground`
- Notification badge: `bg-destructive` dot with count

**Sidebar (desktop):**

- Use shadcn Sidebar component
- Menu style: Default / Translucent (as per preset)
- Menu accent: Subtle
- Active item uses preset accent styling

### Menu / Translucent Style

The preset uses **translucent menus** with a **subtle accent** for active items:

- Menu background: semi-transparent with backdrop blur
- Active menu item: subtle highlight (not bold contrast)
- Hover: gentle opacity/color shift

---

## Bilingual Text Patterns

### Label Convention

Primary language: Traditional Chinese. English as subtitle or parenthetical where needed.

```tsx
// Page titles — Chinese primary
<h1>事件報告</h1>

// Form labels — Chinese with English hint
<Label>電郵地址 (Email)</Label>
<Label>單位註冊密碼 (Flat Registration Password)</Label>

// Status — Chinese only (universally understood in context)
<Badge>待處理</Badge>
<Badge>跟進中</Badge>

// Buttons — Chinese primary
<Button>提交</Button>
<Button>取消</Button>
<Button>登入</Button>
```

### Anonymous Author Display

```tsx
// Standard author
<span className="font-medium text-foreground">陳大文</span>

// Anonymous author
<span className="text-muted-foreground italic">匿名業戶</span>
```

---

## Anti-Patterns (Do NOT Use)

- ❌ **Emojis as icons** — Use HugeIcons only
- ❌ **Mixing icon libraries** — Do NOT use Lucide, Heroicons, or other icon sets alongside HugeIcons
- ❌ **Hardcoded hex colors** — Use shadcn CSS variable classes (`bg-primary`, `text-muted-foreground`)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-200ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y
- ❌ **Floating labels** — Use static labels for CJK readability
- ❌ **Font size below 14px for Chinese** — Illegible for elderly users
- ❌ **Decorative gradients** — Flat design, no gradients on content
- ❌ **Custom sidebar/nav** — Use shadcn Sidebar component

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use HugeIcons SVG)
- [ ] All icons from HugeIcons (no mixing with Lucide/Heroicons)
- [ ] Colors use shadcn CSS variable classes, not hardcoded hex
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-200ms)
- [ ] Text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets minimum 44x44px
- [ ] Responsive: 375px, 768px, 1280px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Chinese text minimum 14px, body line-height 1.6
- [ ] CJK-heavy blocks use `font-sans` (Noto Sans HK)
- [ ] All labels in Traditional Chinese (繁體中文)
- [ ] shadcn/ui components used (not custom implementations)
