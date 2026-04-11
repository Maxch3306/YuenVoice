import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'yuenvoice-install-dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    // Don't show if user previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
      <span>{t.install.banner}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-md bg-primary-foreground/20 px-3 py-1 text-xs font-medium transition-colors hover:bg-primary-foreground/30"
        >
          {t.install.button}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-1 text-xs font-medium transition-colors hover:bg-primary-foreground/20"
          aria-label={t.common.close}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
