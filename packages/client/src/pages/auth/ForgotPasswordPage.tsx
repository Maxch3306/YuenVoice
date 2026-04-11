import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Loading03Icon,
  CheckmarkCircle02Icon,
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

import { forgotPassword } from '@/services/auth';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('請輸入電郵地址');
      return false;
    }
    if (!validateEmail(email)) {
      setEmailError('電郵格式不正確');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setIsLoading(false);
      setIsSubmitted(true);
    }
  }

  // ─── Success state ────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="text-primary">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} />
            </div>
            <h2 className="text-xl font-bold">已發送</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              如果此電郵已註冊，你將收到重設密碼的連結
              <br />
              <span className="text-xs">
                If registered, you will receive a reset link.
              </span>
            </p>
            <Link
              to="/login"
              className="text-primary mt-2 text-sm font-medium"
            >
              &larr; 返回登入
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
        <CardTitle className="text-2xl font-bold">忘記密碼</CardTitle>
        <CardDescription className="leading-relaxed">
          輸入你的電郵地址，我們將發送重設密碼連結
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              電郵地址 (Email)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              disabled={isLoading}
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p className="text-destructive text-sm">{emailError}</p>
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
              '發送重設連結'
            )}
          </Button>

          {/* Back to login */}
          <div className="text-center">
            <Link
              to="/login"
              className="text-muted-foreground hover:text-primary text-sm"
            >
              &larr; 返回登入
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
