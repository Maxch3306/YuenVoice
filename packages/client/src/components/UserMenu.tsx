import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserCircleIcon,
  Settings01Icon,
  Logout01Icon,
  Sun01Icon,
  Moon01Icon,
  Download01Icon,
  LanguageSkillIcon,
  Home01Icon,
} from '@hugeicons/core-free-icons';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/theme-provider';
import { useT, useLanguageStore } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const t = useT();

  // Language toggle
  const { lang, toggle: toggleLang } = useLanguageStore();

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }

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
          aria-label={t.userMenu.ariaLabel}
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
          <span>{isDark ? t.userMenu.lightMode : t.userMenu.darkMode}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleLang} className="cursor-pointer">
          <HugeiconsIcon icon={LanguageSkillIcon} size={16} />
          <span>{lang === 'zh' ? 'English' : '繁體中文'}</span>
        </DropdownMenuItem>
        {installPrompt && (
          <DropdownMenuItem onClick={handleInstall} className="cursor-pointer">
            <HugeiconsIcon icon={Download01Icon} size={16} />
            <span>{t.install.menuItem}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/profile/flats')} className="cursor-pointer">
          <HugeiconsIcon icon={Home01Icon} size={16} />
          <span>{t.userMenu.myFlats}</span>
        </DropdownMenuItem>
        {user?.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
            <HugeiconsIcon icon={Settings01Icon} size={16} />
            <span>{t.userMenu.admin}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <HugeiconsIcon icon={Logout01Icon} size={16} />
          <span>{t.userMenu.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
