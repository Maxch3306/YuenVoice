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

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

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
      errors.password = '請輸入新密碼';
    } else if (password.length < 8) {
      errors.password = '密碼最少需要8個字元';
    }

    if (!confirmPassword) {
      errors.confirmPassword = '請確認密碼';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = '密碼不一致';
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
        setServerError(message || '重設密碼失敗，請稍後再試');
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
            <h2 className="text-xl font-bold">密碼已重設</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              你的密碼已成功重設，正在跳轉至登入頁面...
              <br />
              <span className="text-xs">
                Password reset successfully. Redirecting to login...
              </span>
            </p>
            <Link
              to="/login"
              className="text-primary mt-2 text-sm font-medium"
            >
              立即登入
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
            <h2 className="text-xl font-bold">連結已失效</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              此重設密碼連結已過期或無效
              <br />
              <span className="text-xs">
                This reset link has expired or is invalid.
              </span>
            </p>
            <Link to="/forgot-password">
              <Button className="mt-2">重新申請重設密碼</Button>
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
        <CardTitle className="text-2xl font-bold">重設密碼</CardTitle>
        <CardDescription>請輸入你的新密碼</CardDescription>
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
              新密碼 (New Password)
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
                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
              >
                <HugeiconsIcon
                  icon={showPassword ? ViewOffIcon : ViewIcon}
                  size={18}
                />
              </button>
            </div>
            <p className="text-muted-foreground text-xs">最少8個字元</p>
            {fieldErrors.password && (
              <p className="text-destructive text-sm">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              確認新密碼 (Confirm New Password)
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
                aria-label={showConfirm ? '隱藏密碼' : '顯示密碼'}
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
              '重設密碼'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
