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
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/translations';

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
  t,
}: {
  currentStep: number;
  t: Translations;
}) {
  const stepLabels = [t.register.step1, t.register.step2, t.register.step3];

  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {stepLabels.map((label, index) => {
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
  t,
}: {
  data: Step1Data;
  errors: FieldErrors;
  onChange: (field: keyof Step1Data, value: string) => void;
  onNext: () => void;
  blocks: string[];
  floors: string[];
  units: string[];
  t: Translations;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t.register.step1Title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {t.register.step1Subtitle}
        </p>
      </div>

      {/* Block */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t.common.block}</Label>
        <Select
          value={data.block || undefined}
          onValueChange={(v) => onChange('block', v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.register.selectBlock} />
          </SelectTrigger>
          <SelectContent>
            {blocks.map((b) => (
              <SelectItem key={b} value={b}>
                {b}{t.register.blockSuffix}
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
        <Label className="text-sm font-medium">{t.common.floor}</Label>
        <Select
          value={data.floor || undefined}
          onValueChange={(v) => onChange('floor', v)}
          disabled={!data.block}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.register.selectFloor} />
          </SelectTrigger>
          <SelectContent>
            {floors.map((f) => (
              <SelectItem key={f} value={f}>
                {f}{t.register.floorSuffix}
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
        <Label className="text-sm font-medium">{t.common.unit}</Label>
        <Select
          value={data.unitNumber || undefined}
          onValueChange={(v) => onChange('unitNumber', v)}
          disabled={!data.block || !data.floor}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.register.selectUnit} />
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
        {t.register.next}
      </Button>

      <div className="text-center text-sm">
        {t.register.hasAccount}{' '}
        <Link to="/login" className="text-primary font-medium">
          {t.register.login}
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
  t,
}: {
  flatLabel: string;
  flatPassword: string;
  error: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  t: Translations;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t.register.step2Title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {t.register.step2Subtitle}
        </p>
      </div>

      {/* Selected flat display */}
      <div className="bg-muted rounded-md p-3 text-sm">
        {t.register.selected}: {flatLabel}
      </div>

      {/* Flat registration password */}
      <div className="space-y-2">
        <Label htmlFor="flatPassword" className="text-sm font-medium">
          {t.register.regPassword}
        </Label>
        <Input
          id="flatPassword"
          type="password"
          placeholder={t.register.regPasswordPlaceholder}
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
          {t.register.prev}
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
            t.register.next
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
  t,
}: {
  data: Step3Data;
  errors: FieldErrors;
  serverError: string;
  isLoading: boolean;
  onChange: (field: keyof Step3Data, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  t: Translations;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">{t.register.step3Title}</h2>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          {t.register.name}
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
          {t.register.email}
        </Label>
        <Input
          id="regEmail"
          type="email"
          placeholder={t.login.emailPlaceholder}
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
          {t.register.phone}
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
          {t.register.password}
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
            aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
          >
            <HugeiconsIcon
              icon={showPassword ? ViewOffIcon : ViewIcon}
              size={18}
            />
          </button>
        </div>
        <p className="text-muted-foreground text-xs">{t.register.passwordHint}</p>
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password}</p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          {t.register.confirmPassword}
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
            aria-label={showConfirm ? t.login.hidePassword : t.login.showPassword}
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
          {t.register.prev}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={18}
              className="animate-spin"
            />
          ) : (
            t.register.submit
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
  const t = useT();

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
  const flatLabel = `${step1.block}${t.register.blockSuffix} ${step1.floor}${t.register.floorSuffix} ${step1.unitNumber}`;

  // ─── Step 1 validation ────────────────────────────────────────
  function validateStep1(): boolean {
    const errors: FieldErrors = {};
    if (!step1.block) errors.block = t.register.errorRequired.block;
    if (!step1.floor) errors.floor = t.register.errorRequired.floor;
    if (!step1.unitNumber) errors.unitNumber = t.register.errorRequired.unit;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─── Step 2 validation (calls backend) ────────────────────────
  async function validateStep2(): Promise<boolean> {
    if (!flatPassword.trim()) {
      setFlatPasswordError(t.register.regPasswordPlaceholder);
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
      setFlatPasswordError(t.register.regPasswordError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Step 3 validation ────────────────────────────────────────
  function validateStep3(): boolean {
    const errors: FieldErrors = {};

    if (!step3.name.trim()) {
      errors.name = t.register.errorRequired.name;
    }
    if (!step3.email.trim()) {
      errors.email = t.register.errorRequired.email;
    } else if (!validateEmail(step3.email)) {
      errors.email = t.register.errorFormat.email;
    }
    if (!step3.password) {
      errors.password = t.register.errorRequired.password;
    } else if (step3.password.length < 8) {
      errors.password = t.register.errorFormat.passwordMin;
    }
    if (!step3.confirmPassword) {
      errors.confirmPassword = t.register.errorRequired.confirmPassword;
    } else if (step3.password !== step3.confirmPassword) {
      errors.confirmPassword = t.register.errorFormat.passwordMismatch;
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
      setServerError(message || t.register.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t.register.title}</CardTitle>
        <CardDescription>{t.register.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <StepIndicator currentStep={step} t={t} />

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
            t={t}
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
            t={t}
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
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}
