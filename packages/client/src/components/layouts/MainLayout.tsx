import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ClipboardIcon,
  BubbleChatIcon,
  File01Icon,
  Notification01Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { cn } from '@/lib/utils';
import UserMenu from '@/components/UserMenu';
import OfflineBanner from '@/components/OfflineBanner';
import InstallPrompt from '@/components/InstallPrompt';

const navItems = [
  { to: '/reports', label: '報告', icon: ClipboardIcon },
  { to: '/discussion', label: '討論', icon: BubbleChatIcon },
  { to: '/oc', label: '法團', icon: File01Icon },
  { to: '/notifications', label: '通知', icon: Notification01Icon },
] as const;

export default function MainLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OfflineBanner />
      <InstallPrompt />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <NavLink to="/" className="font-mono text-lg font-bold tracking-tight text-primary">
          YUENVOICE
        </NavLink>

        <div className="flex items-center gap-2">
          {/* Notification bell (desktop) */}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
            aria-label="通知"
          >
            <HugeiconsIcon icon={Notification01Icon} size={24} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── Sidebar (desktop) ──────────────────────────────── */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:block">
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <HugeiconsIcon icon={item.icon} size={20} />
                <span>{item.label}</span>
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}

            {/* Admin link — visible only for admin role */}
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'mt-4 flex h-11 cursor-pointer items-center gap-3 rounded-md border-t border-border px-3 pt-4 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <HugeiconsIcon icon={Settings01Icon} size={20} />
                <span>管理後台</span>
              </NavLink>
            )}
          </nav>
        </aside>

        {/* ── Page content ───────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom navigation (mobile) ───────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative flex h-full min-w-[64px] cursor-pointer flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <span className="relative">
              <HugeiconsIcon icon={item.icon} size={24} />
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-medium text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
