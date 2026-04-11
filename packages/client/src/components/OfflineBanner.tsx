import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const t = useT();

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
    >
      {t.offline.message}
    </div>
  );
}
