# Auth Pages — UI Design / 認證頁面設計

> Reference: [MASTER.md](../../design-system/yuenvoice/MASTER.md) | [sitemap.md](../ui/sitemap.md)
> Layout: **AuthLayout** — centered card, logo on top
> Access: Public

---

## AuthLayout Structure

```
┌─────────────────────────────────────────┐
│                                         │
│              bg-background              │
│                                         │
│         ┌─── YUENVOICE ───┐             │
│         │   Logo + Name    │             │
│         └──────────────────┘             │
│                                         │
│    ┌────────────────────────────────┐    │
│    │                                │    │
│    │       Card (bg-card)           │    │
│    │       max-w-md w-full          │    │
│    │       rounded-xl p-8           │    │
│    │                                │    │
│    │       [ Form Content ]         │    │
│    │                                │    │
│    └────────────────────────────────┘    │
│                                         │
│         Footer links (text-sm)          │
│                                         │
└─────────────────────────────────────────┘

Mobile: Card fills width with p-4 margin
Desktop: Card centered, max-w-md
```

---

## 1. LoginPage (`/login`) / 登入頁

```
┌────────────────────────────────────┐
│                                    │
│         YUENVOICE Logo             │
│         屋苑通訊平台                │
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │  ┌── 登入 ──────────────┐    │  │
│  │  │  h2, font-bold       │    │  │
│  │  └──────────────────────┘    │  │
│  │                              │  │
│  │  電郵地址 (Email)             │  │
│  │  ┌──────────────────────┐    │  │
│  │  │ name@example.com     │    │  │
│  │  └──────────────────────┘    │  │
│  │                              │  │
│  │  密碼 (Password)             │  │
│  │  ┌──────────────────────┐    │  │
│  │  │ ••••••••        [👁]  │    │  │
│  │  └──────────────────────┘    │  │
│  │                              │  │
│  │  ┌──────────────────────┐    │  │
│  │  │       登入            │    │  │
│  │  │   (Button default)    │    │  │
│  │  └──────────────────────┘    │  │
│  │                              │  │
│  │  忘記密碼？        ← link    │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│  還沒有帳戶？ 立即註冊 ← link      │
│                                    │
└────────────────────────────────────┘
```

### Components

| Element | shadcn Component | Props / Classes |
|---------|-----------------|-----------------|
| Logo | Custom SVG | `h-12 w-auto mx-auto` |
| Card | `Card` | `max-w-md w-full mx-auto` |
| Title | `CardHeader` | `text-2xl font-bold text-center` |
| Email input | `Input` | `type="email"` |
| Password input | `Input` | `type="password"` with toggle icon |
| Submit button | `Button` | `variant="default" w-full h-11` |
| Forgot link | `Link` | `text-sm text-muted-foreground hover:text-primary` |
| Register link | `Link` | `text-sm text-primary font-medium` |
| Error alert | `Alert` | `variant="destructive"` — shown below form on error |

### States

- **Loading**: Button shows spinner, inputs disabled
- **Error — wrong credentials**: Alert at top of form: "電郵或密碼不正確"
- **Error — account disabled**: Alert: "此帳戶已被停用，請聯絡管理處"
- **Validation**: Inline field errors in `text-destructive text-sm` below each input

---

## 2. RegisterPage (`/register`) / 註冊頁

Multi-step form with progress indicator.

### Step Indicator

```
  ①─────────②─────────③
 選擇單位    驗證密碼   建立帳戶

  ● active = bg-primary text-primary-foreground
  ○ pending = bg-muted text-muted-foreground
  ✓ done = bg-primary text-primary-foreground (with check icon)
```

### Step 1 — 選擇單位 (Select Unit)

```
┌──────────────────────────────────┐
│                                  │
│  ①━━━━━━━②───────③               │
│  選擇單位                         │
│                                  │
│  h2: 選擇你的單位                  │
│  p: 請選擇你所屬的座數及單位號碼     │
│                                  │
│  座 (Block)                      │
│  ┌──────────────────────┐        │
│  │ 選擇座數         ▼   │        │
│  └──────────────────────┘        │
│  Options: A座 / B座 / C座        │
│                                  │
│  樓層 (Floor)                    │
│  ┌──────────────────────┐        │
│  │ 選擇樓層         ▼   │        │
│  └──────────────────────┘        │
│  Options: 1樓 — 20樓             │
│                                  │
│  單位 (Unit)                     │
│  ┌──────────────────────┐        │
│  │ 選擇單位         ▼   │        │
│  └──────────────────────┘        │
│  Options: 1 — 8                  │
│                                  │
│  ┌──────────────────────┐        │
│  │       下一步          │        │
│  └──────────────────────┘        │
│                                  │
│  已有帳戶？ 登入 ← link          │
│                                  │
└──────────────────────────────────┘
```

### Step 2 — 驗證密碼 (Verify Flat Password)

```
┌──────────────────────────────────┐
│                                  │
│  ①━━━━━━━②━━━━━━━③               │
│          驗證密碼                  │
│                                  │
│  h2: 輸入單位註冊密碼              │
│  p: 請輸入管理處提供的             │
│     單位註冊密碼                   │
│                                  │
│  已選擇: A座 12樓 3號             │
│  (bg-muted rounded-md p-3)       │
│                                  │
│  單位註冊密碼                     │
│  ┌──────────────────────┐        │
│  │                      │        │
│  └──────────────────────┘        │
│  ⚠ Error: "註冊密碼不正確"        │
│                                  │
│  ← 上一步    ┌──────────┐        │
│              │  下一步   │        │
│              └──────────┘        │
│                                  │
└──────────────────────────────────┘
```

### Step 3 — 建立帳戶 (Create Account)

```
┌──────────────────────────────────┐
│                                  │
│  ①━━━━━━━②━━━━━━━③               │
│                  建立帳戶         │
│                                  │
│  h2: 建立你的帳戶                 │
│                                  │
│  姓名 (Name)                     │
│  ┌──────────────────────┐        │
│  │                      │        │
│  └──────────────────────┘        │
│                                  │
│  電郵地址 (Email)                 │
│  ┌──────────────────────┐        │
│  │                      │        │
│  └──────────────────────┘        │
│                                  │
│  電話號碼 (Phone) — 選填          │
│  ┌──────────────────────┐        │
│  │                      │        │
│  └──────────────────────┘        │
│                                  │
│  密碼 (Password)                 │
│  ┌──────────────────────┐        │
│  │                 [👁]  │        │
│  └──────────────────────┘        │
│  最少8個字元                      │
│                                  │
│  確認密碼 (Confirm Password)     │
│  ┌──────────────────────┐        │
│  │                 [👁]  │        │
│  └──────────────────────┘        │
│                                  │
│  ← 上一步    ┌──────────┐        │
│              │  註冊     │        │
│              └──────────┘        │
│                                  │
└──────────────────────────────────┘
```

### Components

| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Step indicator | Custom | Horizontal stepper with numbers + labels |
| Block/Floor/Unit | `Select` | Three separate dropdowns |
| Selected flat display | `div` | `bg-muted rounded-md p-3 text-sm` |
| Back button | `Button variant="ghost"` | Left-aligned |
| Next/Submit button | `Button variant="default"` | Right-aligned |
| Password strength | Custom | Text hint below input |

---

## 3. ForgotPasswordPage (`/forgot-password`) / 忘記密碼

```
┌──────────────────────────────────┐
│                                  │
│  h2: 忘記密碼                     │
│  p: 輸入你的電郵地址，我們將       │
│     發送重設密碼連結               │
│                                  │
│  電郵地址 (Email)                 │
│  ┌──────────────────────┐        │
│  │                      │        │
│  └──────────────────────┘        │
│                                  │
│  ┌──────────────────────┐        │
│  │     發送重設連結       │        │
│  └──────────────────────┘        │
│                                  │
│  ← 返回登入                      │
│                                  │
└──────────────────────────────────┘

── Success state ──────────────────
│                                  │
│  ✓ (CheckCircle icon, green)     │
│                                  │
│  h2: 已發送                       │
│  p: 如果此電郵已註冊，你將收到     │
│     重設密碼的連結                 │
│                                  │
│  ← 返回登入                      │
│                                  │
```

---

## 4. ResetPasswordPage (`/reset-password`) / 重設密碼

```
┌──────────────────────────────────┐
│                                  │
│  h2: 重設密碼                     │
│  p: 請輸入你的新密碼               │
│                                  │
│  新密碼                           │
│  ┌──────────────────────┐        │
│  │                 [👁]  │        │
│  └──────────────────────┘        │
│  最少8個字元                      │
│                                  │
│  確認新密碼                       │
│  ┌──────────────────────┐        │
│  │                 [👁]  │        │
│  └──────────────────────┘        │
│                                  │
│  ┌──────────────────────┐        │
│  │     重設密碼           │        │
│  └──────────────────────┘        │
│                                  │
└──────────────────────────────────┘

── Error state (invalid token) ────
│                                  │
│  ✗ (XCircle icon, red)           │
│                                  │
│  h2: 連結已失效                   │
│  p: 此重設密碼連結已過期或無效     │
│                                  │
│  ┌──────────────────────┐        │
│  │  重新申請重設密碼       │        │
│  └──────────────────────┘        │
│                                  │
```
