import { Outlet } from 'react-router-dom';
import { useT } from '@/lib/i18n';

export default function AuthLayout() {
  const t = useT();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-primary">
            {t.auth.appName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.auth.tagline}
          </p>
        </div>

        {/* Auth form card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
