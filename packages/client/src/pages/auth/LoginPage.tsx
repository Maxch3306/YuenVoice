import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ViewIcon,
  ViewOffIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAuthStore } from '@/stores/auth-store';
import { login } from '@/services/auth';
import { useT } from '@/lib/i18n';

interface FieldErrors {
  email?: string;
  password?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const t = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = t.login.errorRequired.email;
    } else if (!validateEmail(email)) {
      errors.email = t.login.errorFormat.email;
    }

    if (!password) {
      errors.password = t.login.errorRequired.password;
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
      const { user, accessToken } = await login({ email, password });
      setAuth(user, accessToken);
      navigate('/reports', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const message = (
        err as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;

      if (status === 401) {
        setServerError(t.login.errorInvalid);
      } else if (status === 403) {
        setServerError(t.login.errorDisabled);
      } else {
        setServerError(message || t.login.errorGeneric);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t.login.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              {t.login.email}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t.login.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && (
              <p className="text-destructive text-sm">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              {t.login.password}
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
            {fieldErrors.password && (
              <p className="text-destructive text-sm">
                {fieldErrors.password}
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
              t.login.submit
            )}
          </Button>

          {/* Forgot password */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-muted-foreground hover:text-primary text-sm"
            >
              {t.login.forgotPassword}
            </Link>
          </div>
        </form>
      </CardContent>

      {/* Register link */}
      <div className="pb-6 text-center text-sm">
        {t.login.noAccount}{' '}
        <Link to="/register" className="text-primary font-medium">
          {t.login.register}
        </Link>
      </div>
    </Card>
  );
}
