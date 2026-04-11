const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface PaginationParams {
  offset: number
  limit: number
}

export interface PaginatedMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginatedMeta
}

/**
 * Parse page/limit from query params into offset/limit for Sequelize.
 * Handles edge cases: negative values, zero, values exceeding max.
 */
export function parsePagination(query: { page?: string | number; limit?: string | number }): PaginationParams {
  let page = Number(query.page) || DEFAULT_PAGE
  let limit = Number(query.limit) || DEFAULT_LIMIT

  if (page < 1) page = DEFAULT_PAGE
  if (limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  const offset = (page - 1) * limit

  return { offset, limit }
}

/**
 * Build a standardized paginated response.
 */
export function paginatedResponse<T>(
  rows: T[],
  count: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data: rows,
    meta: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  }
}
