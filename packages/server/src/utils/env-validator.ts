const DEV_DEFAULTS = [
  'dev-access-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
]

/**
 * Validate required environment variables on startup.
 * Exits the process with code 1 if any critical variables are missing.
 * Warns for optional variables that affect specific features.
 */
export function validateEnv(): void {
  const errors: string[] = []
  const warnings: string[] = []

  // ── Required (fail if missing) ──

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required')
  }

  // ── Required with minimum length ──

  const accessSecret = process.env.JWT_ACCESS_SECRET
  if (!accessSecret) {
    errors.push('JWT_ACCESS_SECRET is required')
  } else if (accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters')
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET
  if (!refreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required')
  } else if (refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters')
  }

  // ── Warn if using dev defaults ──

  if (accessSecret && DEV_DEFAULTS.includes(accessSecret)) {
    warnings.push('JWT_ACCESS_SECRET is using a development default — change in production')
  }
  if (refreshSecret && DEV_DEFAULTS.includes(refreshSecret)) {
    warnings.push('JWT_REFRESH_SECRET is using a development default — change in production')
  }

  // ── Warn if missing (optional but important) ──

  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL is not set — using default localhost. Sessions/caching may not work in production')
  }

  if (!process.env.VAPID_PUBLIC_KEY) {
    warnings.push('VAPID_PUBLIC_KEY is not set — push notifications will not work')
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    warnings.push('VAPID_PRIVATE_KEY is not set — push notifications will not work')
  }

  // ── Output ──

  for (const warning of warnings) {
    console.warn(`[env] WARNING: ${warning}`)
  }

  if (errors.length > 0) {
    console.error('[env] FATAL: Environment validation failed:')
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }
}
