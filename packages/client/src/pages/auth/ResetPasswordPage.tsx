import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ViewIcon,
  ViewOffIcon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { resetPassword } from '@/services/auth';
import { useT } from '@/lib/i18n';

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const t = useT();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!password) {
      errors.password = t.reset.errorRequired.password;
    } else if (password.length < 8) {
      errors.password = t.reset.errorFormat.passwordMin;
    }

    if (!confirmPassword) {
      errors.confirmPassword = t.reset.errorRequired.confirmPassword;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = t.reset.errorFormat.passwordMismatch;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setIsSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400 || status === 404) {
        setIsTokenInvalid(true);
      } else {
        const message = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;
        setServerError(message || t.reset.errorGeneric);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Success state ────────────────────────────────────────────
  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="text-primary">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} />
            </div>
            <h2 className="text-xl font-bold">{t.reset.successTitle}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t.reset.successMessage}
            </p>
            <Link
              to="/login"
              className="text-primary mt-2 text-sm font-medium"
            >
              {t.reset.loginNow}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Invalid token state ──────────────────────────────────────
  if (isTokenInvalid || !token) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="text-destructive">
              <HugeiconsIcon icon={Cancel01Icon} size={48} />
            </div>
            <h2 className="text-xl font-bold">{t.reset.expiredTitle}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t.reset.expiredMessage}
            </p>
            <Link to="/forgot-password">
              <Button className="mt-2">{t.reset.requestNew}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Form state ───────────────────────────────────────────────
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t.reset.title}</CardTitle>
        <CardDescription>{t.reset.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* New password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              {t.reset.newPassword}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      password: undefined,
                    }));
                  }
                }}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                tabIndex={-1}
                aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
              >
                <HugeiconsIcon
                  icon={showPassword ? ViewOffIcon : ViewIcon}
                  size={18}
                />
              </button>
            </div>
            <p className="text-muted-foreground text-xs">{t.reset.passwordHint}</p>
            {fieldErrors.password && (
              <p className="text-destructive text-sm">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              {t.reset.confirmPassword}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }
                }}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.confirmPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                tabIndex={-1}
                aria-label={showConfirm ? t.login.hidePassword : t.login.showPassword}
              >
                <HugeiconsIcon
                  icon={showConfirm ? ViewOffIcon : ViewIcon}
                  size={18}
                />
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-destructive text-sm">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                size={18}
                className="animate-spin"
              />
            ) : (
              t.reset.submit
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
