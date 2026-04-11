import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ViewIcon,
  ViewOffIcon,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAuthStore } from '@/stores/auth-store';
import { register } from '@/services/auth';
import { useBlocks, useFloors, useUnits } from '@/services/flats';
import api from '@/lib/api';

// ─── Constants ──────────────────────────────────────────────────

const STEP_LABELS = ['選擇單位', '驗證密碼', '建立帳戶'];

// ─── Types ──────────────────────────────────────────────────────

interface Step1Data {
  block: string;
  floor: string;
  unitNumber: string;
}

interface Step3Data {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Record<string, string | undefined>;

// ─── Helpers ────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Step Indicator ─────────────────────────────────────────────

function StepIndicator({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {STEP_LABELS.map((label, index) => {
        const stepNum = index + 1;
        const isDone = currentStep > stepNum;
        const isActive = currentStep === stepNum;

        return (
          <div key={label} className="flex items-center">
            {/* Connector line before (except first) */}
            {index > 0 && (
              <div
                className={`h-0.5 w-8 sm:w-12 ${
                  currentStep > index ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              {/* Circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isDone || isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                ) : (
                  stepNum
                )}
              </div>
              {/* Label */}
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Select Unit ────────────────────────────────────────

function Step1({
  data,
  errors,
  onChange,
  onNext,
  blocks,
  floors,
  units,
}: {
  data: Step1Data;
  errors: FieldErrors;
  onChange: (field: keyof Step1Data, value: string) => void;
  onNext: () => void;
  blocks: string[];
  floors: string[];
  units: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">選擇你的單位</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          請選擇你所屬的座數及單位號碼
        </p>
      </div>

      {/* Block */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">座 (Block)</Label>
        <Select
          value={data.block || undefined}
          onValueChange={(v) => onChange('block', v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="選擇座數" />
          </SelectTrigger>
          <SelectContent>
            {blocks.map((b) => (
              <SelectItem key={b} value={b}>
                {b}座
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.block && (
          <p className="text-destructive text-sm">{errors.block}</p>
        )}
      </div>

      {/* Floor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">樓層 (Floor)</Label>
        <Select
          value={data.floor || undefined}
          onValueChange={(v) => onChange('floor', v)}
          disabled={!data.block}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="選擇樓層" />
          </SelectTrigger>
          <SelectContent>
            {floors.map((f) => (
              <SelectItem key={f} value={f}>
                {f}樓
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.floor && (
          <p className="text-destructive text-sm">{errors.floor}</p>
        )}
      </div>

      {/* Unit */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">單位 (Unit)</Label>
        <Select
          value={data.unitNumber || undefined}
          onValueChange={(v) => onChange('unitNumber', v)}
          disabled={!data.block || !data.floor}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="選擇單位" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.unitNumber && (
          <p className="text-destructive text-sm">{errors.unitNumber}</p>
        )}
      </div>

      <Button type="button" className="h-11 w-full" onClick={onNext}>
        下一步
      </Button>

      <div className="text-center text-sm">
        已有帳戶？{' '}
        <Link to="/login" className="text-primary font-medium">
          登入
        </Link>
      </div>
    </div>
  );
}

// ─── Step 2: Verify Flat Password ───────────────────────────────

function Step2({
  flatLabel,
  flatPassword,
  error,
  isLoading,
  onChange,
  onBack,
  onNext,
}: {
  flatLabel: string;
  flatPassword: string;
  error: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">輸入單位註冊密碼</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          請輸入管理處提供的單位註冊密碼
        </p>
      </div>

      {/* Selected flat display */}
      <div className="bg-muted rounded-md p-3 text-sm">
        已選擇: {flatLabel}
      </div>

      {/* Flat registration password */}
      <div className="space-y-2">
        <Label htmlFor="flatPassword" className="text-sm font-medium">
          單位註冊密碼 (Registration Password)
        </Label>
        <Input
          id="flatPassword"
          type="password"
          value={flatPassword}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          aria-invalid={!!error}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isLoading}
        >
          &larr; 上一步
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={18}
              className="animate-spin"
            />
          ) : (
            '下一步'
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Create Account ─────────────────────────────────────

function Step3({
  data,
  errors,
  serverError,
  isLoading,
  onChange,
  onBack,
  onSubmit,
}: {
  data: Step3Data;
  errors: FieldErrors;
  serverError: string;
  isLoading: boolean;
  onChange: (field: keyof Step3Data, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">建立你的帳戶</h2>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          姓名 (Name)
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          disabled={isLoading}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="regEmail" className="text-sm font-medium">
          電郵地址 (Email)
        </Label>
        <Input
          id="regEmail"
          type="email"
          placeholder="name@example.com"
          value={data.email}
          onChange={(e) => onChange('email', e.target.value)}
          disabled={isLoading}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-destructive text-sm">{errors.email}</p>
        )}
      </div>

      {/* Phone (optional) */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium">
          電話號碼 (Phone) — 選填
        </Label>
        <Input
          id="phone"
          type="tel"
          value={data.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="regPassword" className="text-sm font-medium">
          密碼 (Password)
        </Label>
        <div className="relative">
          <Input
            id="regPassword"
            type={showPassword ? 'text' : 'password'}
            value={data.password}
            onChange={(e) => onChange('password', e.target.value)}
            disabled={isLoading}
            aria-invalid={!!errors.password}
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
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password}</p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          確認密碼 (Confirm Password)
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            value={data.confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            disabled={isLoading}
            aria-invalid={!!errors.confirmPassword}
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
        {errors.confirmPassword && (
          <p className="text-destructive text-sm">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isLoading}
        >
          &larr; 上一步
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={18}
              className="animate-spin"
            />
          ) : (
            '註冊'
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 data
  const [step1, setStep1] = useState<Step1Data>({
    block: '',
    floor: '',
    unitNumber: '',
  });

  const { data: blocks = [] } = useBlocks();
  const { data: floors = [] } = useFloors();
  const { data: units = [] } = useUnits(step1.block, step1.floor);

  // Step 2 data
  const [flatPassword, setFlatPassword] = useState('');
  const [flatPasswordError, setFlatPasswordError] = useState('');

  // Step 3 data
  const [step3, setStep3] = useState<Step3Data>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // ─── Flat label ───────────────────────────────────────────────
  const flatLabel = `${step1.block}座 ${step1.floor}樓 ${step1.unitNumber}號`;

  // ─── Step 1 validation ────────────────────────────────────────
  function validateStep1(): boolean {
    const errors: FieldErrors = {};
    if (!step1.block) errors.block = '請選擇座數';
    if (!step1.floor) errors.floor = '請選擇樓層';
    if (!step1.unitNumber) errors.unitNumber = '請選擇單位';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─── Step 2 validation (calls backend) ────────────────────────
  async function validateStep2(): Promise<boolean> {
    if (!flatPassword.trim()) {
      setFlatPasswordError('請輸入註冊密碼');
      return false;
    }

    setIsLoading(true);
    setFlatPasswordError('');
    try {
      await api.post('/api/auth/verify-flat-password', {
        block: step1.block,
        floor: step1.floor,
        unitNumber: step1.unitNumber,
        flatPassword,
      });
      return true;
    } catch {
      setFlatPasswordError('註冊密碼不正確 (Incorrect registration password)');
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Step 3 validation ────────────────────────────────────────
  function validateStep3(): boolean {
    const errors: FieldErrors = {};

    if (!step3.name.trim()) {
      errors.name = '請輸入姓名';
    }
    if (!step3.email.trim()) {
      errors.email = '請輸入電郵地址';
    } else if (!validateEmail(step3.email)) {
      errors.email = '電郵格式不正確';
    }
    if (!step3.password) {
      errors.password = '請輸入密碼';
    } else if (step3.password.length < 8) {
      errors.password = '密碼最少需要8個字元';
    }
    if (!step3.confirmPassword) {
      errors.confirmPassword = '請確認密碼';
    } else if (step3.password !== step3.confirmPassword) {
      errors.confirmPassword = '密碼不一致';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─── Handlers ─────────────────────────────────────────────────

  function handleStep3Change(field: keyof Step3Data, value: string) {
    setStep3((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleNextStep1() {
    if (validateStep1()) {
      setStep(2);
      setFieldErrors({});
    }
  }

  async function handleNextStep2() {
    const valid = await validateStep2();
    if (valid) {
      setStep(3);
      setFieldErrors({});
    }
  }

  async function handleSubmit() {
    if (!validateStep3()) return;

    setIsLoading(true);
    setServerError('');
    try {
      const { user, accessToken } = await register({
        block: step1.block,
        floor: step1.floor,
        unitNumber: step1.unitNumber,
        flatPassword,
        name: step3.name,
        email: step3.email,
        phone: step3.phone || undefined,
        password: step3.password,
      });
      setAuth(user, accessToken);
      navigate('/reports', { replace: true });
    } catch (err: unknown) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setServerError(message || '註冊失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">註冊</CardTitle>
        <CardDescription>建立你的 YUENVOICE 帳戶</CardDescription>
      </CardHeader>
      <CardContent>
        <StepIndicator currentStep={step} />

        {step === 1 && (
          <Step1
            data={step1}
            errors={fieldErrors}
            onChange={(field, value) => {
              if (field === 'block') {
                setStep1({ block: value, floor: '', unitNumber: '' });
              } else if (field === 'floor') {
                setStep1((prev) => ({ ...prev, floor: value, unitNumber: '' }));
              } else {
                setStep1((prev) => ({ ...prev, [field]: value }));
              }
              if (fieldErrors[field]) {
                setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
              }
            }}
            onNext={handleNextStep1}
            blocks={blocks}
            floors={floors}
            units={units}
          />
        )}

        {step === 2 && (
          <Step2
            flatLabel={flatLabel}
            flatPassword={flatPassword}
            error={flatPasswordError}
            isLoading={isLoading}
            onChange={(v) => {
              setFlatPassword(v);
              if (flatPasswordError) setFlatPasswordError('');
            }}
            onBack={() => {
              setStep(1);
              setFlatPasswordError('');
            }}
            onNext={handleNextStep2}
          />
        )}

        {step === 3 && (
          <Step3
            data={step3}
            errors={fieldErrors}
            serverError={serverError}
            isLoading={isLoading}
            onChange={handleStep3Change}
            onBack={() => {
              setStep(2);
              setFieldErrors({});
              setServerError('');
            }}
            onSubmit={handleSubmit}
          />
        )}
      </CardContent>
    </Card>
  );
}
