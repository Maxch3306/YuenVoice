import { NavLink, Outlet } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  UserGroupIcon,
  Building01Icon,
  Audit01Icon,
  ArrowLeft01Icon,
  Notification01Icon,
} from '@hugeicons/core-free-icons';
import { useNotificationStore } from '@/stores/notification-store';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserMenu from '@/components/UserMenu';

const adminNavItems = [
  { to: '/admin', label: '儀表板', icon: DashboardSquare01Icon, end: true },
  { to: '/admin/users', label: '用戶管理', icon: UserGroupIcon, end: false },
  { to: '/admin/flats', label: '單位管理', icon: Building01Icon, end: false },
  { to: '/admin/audit-logs', label: '審計日誌', icon: Audit01Icon, end: false },
] as const;

export default function AdminLayout() {
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground md:hidden"
            aria-label="選單"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>

          <NavLink to="/" className="font-mono text-lg font-bold tracking-tight text-primary">
            YUENVOICE
          </NavLink>
          <span className="hidden text-sm text-muted-foreground sm:inline">(Admin)</span>
        </div>

        <div className="flex items-center gap-2">
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
        {/* ── Sidebar (desktop always visible, mobile toggleable) */}
        <aside
          className={cn(
            'w-56 shrink-0 border-r border-border bg-background',
            mobileMenuOpen ? 'fixed inset-y-14 left-0 z-30 block' : 'hidden md:block'
          )}
        >
          <nav className="flex flex-col gap-1 p-3">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
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
              </NavLink>
            ))}

            {/* Back to main app */}
            <NavLink
              to="/reports"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 flex h-11 cursor-pointer items-center gap-3 rounded-md border-t border-border px-3 pt-4 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
              <span>返回主頁</span>
            </NavLink>
          </nav>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Page content ───────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
