import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserCircleIcon,
  Settings01Icon,
  Logout01Icon,
  Sun01Icon,
  Moon01Icon,
} from '@hugeicons/core-free-icons';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function handleToggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
          aria-label="用戶選單"
        >
          <HugeiconsIcon icon={UserCircleIcon} size={24} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggleTheme} className="cursor-pointer">
          <HugeiconsIcon icon={isDark ? Sun01Icon : Moon01Icon} size={16} />
          <span>{isDark ? '淺色模式' : '深色模式'}</span>
        </DropdownMenuItem>
        {user?.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
            <HugeiconsIcon icon={Settings01Icon} size={16} />
            <span>管理後台</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <HugeiconsIcon icon={Logout01Icon} size={16} />
          <span>登出</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
