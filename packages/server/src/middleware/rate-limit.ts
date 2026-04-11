/**
 * Rate limit preset for auth routes (login, register, refresh).
 * 10 requests per 1 minute window.
 */
export const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
}

/**
 * Rate limit preset for write operations (create report, post, etc.).
 * 20 requests per 1 minute window.
 */
export const writeRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
    },
  },
}

/**
 * Default rate limit for general routes.
 * 100 requests per 1 minute window.
 */
export const defaultRateLimit = {
  config: {
    rateLimit: {
      max: 100,
      timeWindow: '1 minute',
    },
  },
}
