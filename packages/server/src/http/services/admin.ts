import { and, asc, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import type { Env } from '../../env.js'
import {
  users,
  flats,
  userFlats,
  auditLogs,
  incidentReports,
  discussionPosts,
  ocDocuments,
} from '../../db/schema.js'
import { parsePagination, paginatedResponse } from '../../utils/pagination.js'
import { logAudit } from '../audit.js'
import { sanitizeText } from '../sanitize.js'
import { hashPassword } from '../../utils/hash.js'
import { userStore } from '../session-store.js'
import { HttpError } from '../errors.js'

const ROLES = ['resident', 'oc_committee', 'mgmt_staff', 'admin'] as const
type Role = (typeof ROLES)[number]

// Worker-native replacements for node:crypto randomBytes(n).toString(...).
function randomBase64Url(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function randomHexUpper(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function getStats(db: Db) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [[totalUsers], [openReports], [postsThisWeek], [totalDocuments]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.is_active, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(incidentReports)
      .where(inArray(incidentReports.status, ['pending', 'in_progress'])),
    db
      .select({ count: sql<number>`count(*)` })
      .from(discussionPosts)
      .where(gte(discussionPosts.created_at, weekAgo)),
    db.select({ count: sql<number>`count(*)` }).from(ocDocuments),
  ])

  return {
    totalUsers: Number(totalUsers.count),
    openReports: Number(openReports.count),
    postsThisWeek: Number(postsThisWeek.count),
    totalDocuments: Number(totalDocuments.count),
  }
}

// ── Users ─────────────────────────────────────────────────────────────────

export interface ListUsersFilters {
  page?: string | number
  limit?: string | number
  role?: Role
  search?: string
}

export async function listUsers(db: Db, filters: ListUsersFilters) {
  const { offset, limit } = parsePagination(filters)
  const page = Math.floor(offset / limit) + 1

  const conditions = [isNull(users.deleted_at)]
  if (filters.role) conditions.push(eq(users.role, filters.role))
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(or(like(users.name, term), like(users.email, term))!)
  }
  const where = and(...conditions)

  const rows = await db.query.users.findMany({
    where,
    columns: { password_hash: false },
    with: {
      flat: { columns: { id: true, block: true, floor: true, unit_number: true } },
    },
    orderBy: desc(users.created_at),
    limit,
    offset,
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where)

  return paginatedResponse(rows, Number(count), page, limit)
}

export interface CreateUserInput {
  name: string
  email: string
  phone?: string
  role: Role
  flatId?: string
}

export async function createUser(db: Db, adminUserId: string, data: CreateUserInput) {
  if (data.role === 'resident' && !data.flatId) {
    throw new HttpError(400, '住戶必須連結單位')
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1)
  if (existing) throw new HttpError(409, '此電郵已被使用')

  let flat: typeof flats.$inferSelect | null = null
  if (data.flatId) {
    const [f] = await db.select().from(flats).where(eq(flats.id, data.flatId)).limit(1)
    if (!f) throw new HttpError(400, '單位不存在')
    flat = f
  }

  const tempPassword = randomBase64Url(6)
  const passwordHash = await hashPassword(tempPassword)

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      phone: data.phone ?? null,
      password_hash: passwordHash,
      name: sanitizeText(data.name),
      flat_id: flat?.id ?? null,
      role: data.role,
    })
    .returning()

  await logAudit(db, adminUserId, 'create_user', 'user', user.id, {
    email: data.email,
    role: data.role,
    flat_id: flat?.id ?? null,
  })

  const { password_hash: _ignored, ...safeUser } = user
  void _ignored

  return { user: { ...safeUser, flat: flat ?? null }, tempPassword }
}

export async function updateUserRole(db: Db, adminUserId: string, id: string, role: Role) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return null

  const oldRole = user.role
  await db.update(users).set({ role }).where(eq(users.id, id))

  await logAudit(db, adminUserId, 'update_role', 'user', id, { oldRole, newRole: role })

  return db.query.users.findFirst({ where: eq(users.id, id), columns: { password_hash: false } })
}

export async function updateUserStatus(db: Db, adminUserId: string, id: string, isActive: boolean) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return null

  const oldStatus = user.is_active
  await db.update(users).set({ is_active: isActive }).where(eq(users.id, id))

  await logAudit(db, adminUserId, 'update_status', 'user', id, {
    oldStatus,
    newStatus: isActive,
  })

  return db.query.users.findFirst({ where: eq(users.id, id), columns: { password_hash: false } })
}

export async function resetUserPassword(db: Db, env: Env, adminUserId: string, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user || user.deleted_at) return null

  const tempPassword = randomBase64Url(6)
  const passwordHash = await hashPassword(tempPassword)
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, id))

  // Kill existing refresh sessions so the old password can't be reused.
  await userStore(env, id).del('session')

  await logAudit(db, adminUserId, 'reset_user_password', 'user', id, {})

  return { tempPassword }
}

export type DeleteUserResult =
  | { status: 'not_found' }
  | { status: 'self' }
  | { status: 'last_admin' }
  | { status: 'deleted' }

export async function deleteUser(
  db: Db,
  env: Env,
  adminUserId: string,
  id: string,
): Promise<DeleteUserResult> {
  if (id === adminUserId) return { status: 'self' }

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user || user.deleted_at) return { status: 'not_found' }

  // Guard against removing the last remaining active admin.
  if (user.role === 'admin') {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.role, 'admin'),
          eq(users.is_active, true),
          isNull(users.deleted_at),
          ne(users.id, id),
        ),
      )
    if (Number(count) === 0) return { status: 'last_admin' }
  }

  const originalEmail = user.email

  await db
    .update(users)
    .set({
      email: `deleted+${id}@yuenvoice.invalid`,
      name: '已刪除帳戶',
      phone: null,
      flat_id: null,
      is_active: false,
      deleted_at: new Date().toISOString(),
      password_hash: await hashPassword(randomBase64Url(24)),
    })
    .where(eq(users.id, id))

  await db.delete(userFlats).where(eq(userFlats.user_id, id))

  // Kill existing refresh sessions.
  await userStore(env, id).del('session')

  await logAudit(db, adminUserId, 'delete_user', 'user', id, {
    email: originalEmail,
    role: user.role,
  })

  return { status: 'deleted' }
}

export interface UserFlatSummary {
  id: string
  block: string
  floor: string
  unit_number: string
  is_primary: boolean
  linked_at: string | null
}

// List a user's flats (primary + linked). Returns null when the user is missing
// or soft-deleted.
export async function listUserFlats(db: Db, id: string): Promise<UserFlatSummary[] | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, deleted_at: true, flat_id: true },
    with: { flat: { columns: { id: true, block: true, floor: true, unit_number: true } } },
  })
  if (!user || user.deleted_at) return null

  const links = await db
    .select()
    .from(userFlats)
    .where(eq(userFlats.user_id, id))
    .orderBy(desc(userFlats.linked_at))

  const linkedIds = links.map((l) => l.flat_id)
  const linkedFlats = linkedIds.length
    ? await db
        .select({
          id: flats.id,
          block: flats.block,
          floor: flats.floor,
          unit_number: flats.unit_number,
        })
        .from(flats)
        .where(inArray(flats.id, linkedIds))
    : []
  const flatById = new Map(linkedFlats.map((f) => [f.id, f]))

  const result: UserFlatSummary[] = []

  const primary = user.flat ?? null
  if (primary) {
    result.push({
      id: primary.id,
      block: primary.block,
      floor: primary.floor,
      unit_number: primary.unit_number,
      is_primary: true,
      linked_at: null,
    })
  }

  for (const link of links) {
    const flat = flatById.get(link.flat_id)
    if (!flat) continue
    if (primary && flat.id === primary.id) continue
    result.push({
      id: flat.id,
      block: flat.block,
      floor: flat.floor,
      unit_number: flat.unit_number,
      is_primary: false,
      linked_at: link.linked_at,
    })
  }

  return result
}

// Admin unlink: remove any flat (including the primary) from a user's account.
export async function unlinkUserFlat(db: Db, adminUserId: string, id: string, flatId: string) {
  const [user] = await db.select({ id: users.id, flat_id: users.flat_id }).from(users).where(eq(users.id, id)).limit(1)
  if (!user) throw new HttpError(404, 'User not found')

  if (user.flat_id === flatId) {
    await db.update(users).set({ flat_id: null }).where(eq(users.id, id))
    // Drop any stray join-table row for the same flat too.
    await db.delete(userFlats).where(and(eq(userFlats.user_id, id), eq(userFlats.flat_id, flatId)))
  } else {
    const deleted = await db
      .delete(userFlats)
      .where(and(eq(userFlats.user_id, id), eq(userFlats.flat_id, flatId)))
      .returning({ user_id: userFlats.user_id })
    if (deleted.length === 0) throw new HttpError(404, 'Flat link not found')
  }

  await logAudit(db, adminUserId, 'unlink_user_flat', 'user', id, { flat_id: flatId })
}

// ── Flats ─────────────────────────────────────────────────────────────────

export async function listBlocks(db: Db) {
  const rows = await db.selectDistinct({ block: flats.block }).from(flats).orderBy(asc(flats.block))
  return rows.map((r) => r.block)
}

export interface ListFlatsFilters {
  page?: string | number
  limit?: string | number
  block?: string
  search?: string
}

export async function listFlats(db: Db, filters: ListFlatsFilters) {
  const { offset, limit } = parsePagination(filters)
  const page = Math.floor(offset / limit) + 1

  const conditions = []
  if (filters.block) conditions.push(eq(flats.block, filters.block))
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      or(like(flats.block, term), like(flats.floor, term), like(flats.unit_number, term))!,
    )
  }
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db.query.flats.findMany({
    where,
    with: { residents: { columns: { id: true } } },
    orderBy: [asc(flats.block), asc(flats.floor), asc(flats.unit_number)],
    limit,
    offset,
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(flats).where(where)

  const data = rows.map(({ residents, ...flat }) => ({
    ...flat,
    residentCount: residents?.length ?? 0,
  }))

  return paginatedResponse(data, Number(count), page, limit)
}

export async function exportFlatsCsv(db: Db, block?: string): Promise<string> {
  const where = block ? eq(flats.block, block) : undefined
  const rows = await db
    .select()
    .from(flats)
    .where(where)
    .orderBy(asc(flats.block), asc(flats.floor), asc(flats.unit_number))

  const BOM = '﻿'
  const header = '座,樓層,單位,註冊密碼,註冊狀態'
  const lines = rows.map(
    (f) =>
      `${f.block},${f.floor},${f.unit_number},${f.registration_password},${f.is_registration_open ? '開放' : '關閉'}`,
  )
  return BOM + [header, ...lines].join('\n')
}

export interface CreateFlatInput {
  block: string
  floor: string
  unitNumber: string
}

export async function createFlat(db: Db, adminUserId: string, data: CreateFlatInput) {
  const [existing] = await db
    .select({ id: flats.id })
    .from(flats)
    .where(and(eq(flats.block, data.block), eq(flats.floor, data.floor), eq(flats.unit_number, data.unitNumber)))
    .limit(1)
  if (existing) throw new HttpError(409, '此單位已存在')

  const password = randomHexUpper(4)

  const [flat] = await db
    .insert(flats)
    .values({
      block: data.block,
      floor: data.floor,
      unit_number: data.unitNumber,
      registration_password: password,
      is_registration_open: true,
    })
    .returning()

  await logAudit(db, adminUserId, 'create_flat', 'flat', flat.id, {
    block: data.block,
    floor: data.floor,
    unit_number: data.unitNumber,
  })

  return flat
}

export interface UpdateFlatInput {
  block?: string
  floor?: string
  unitNumber?: string
  isRegistrationOpen?: boolean
}

export async function updateFlat(db: Db, adminUserId: string, id: string, body: UpdateFlatInput) {
  const [flat] = await db.select().from(flats).where(eq(flats.id, id)).limit(1)
  if (!flat) return null

  const changes: Record<string, unknown> = {}
  const set: Partial<typeof flats.$inferInsert> = {}
  if (body.block !== undefined) {
    changes.old_block = flat.block
    set.block = body.block
  }
  if (body.floor !== undefined) {
    changes.old_floor = flat.floor
    set.floor = body.floor
  }
  if (body.unitNumber !== undefined) {
    changes.old_unit_number = flat.unit_number
    set.unit_number = body.unitNumber
  }
  if (body.isRegistrationOpen !== undefined) {
    changes.old_is_registration_open = flat.is_registration_open
    set.is_registration_open = body.isRegistrationOpen
  }

  if (Object.keys(set).length > 0) {
    await db.update(flats).set(set).where(eq(flats.id, id))
  }

  await logAudit(db, adminUserId, 'update_flat', 'flat', id, changes)

  const [updated] = await db.select().from(flats).where(eq(flats.id, id)).limit(1)
  return updated
}

export type DeleteFlatResult =
  | { status: 'not_found' }
  | { status: 'has_residents'; residentCount: number }
  | { status: 'deleted' }

export async function deleteFlat(db: Db, adminUserId: string, id: string): Promise<DeleteFlatResult> {
  const flat = await db.query.flats.findFirst({
    where: eq(flats.id, id),
    with: { residents: { columns: { id: true } } },
  })
  if (!flat) return { status: 'not_found' }

  const residentCount = flat.residents?.length ?? 0
  if (residentCount > 0) return { status: 'has_residents', residentCount }

  await logAudit(db, adminUserId, 'delete_flat', 'flat', id, {
    block: flat.block,
    floor: flat.floor,
    unit_number: flat.unit_number,
  })

  await db.delete(flats).where(eq(flats.id, id))
  return { status: 'deleted' }
}

export async function resetFlatPassword(db: Db, adminUserId: string, id: string) {
  const [flat] = await db.select().from(flats).where(eq(flats.id, id)).limit(1)
  if (!flat) return null

  const newPassword = randomHexUpper(4)
  await db.update(flats).set({ registration_password: newPassword }).where(eq(flats.id, id))

  await logAudit(db, adminUserId, 'reset_password', 'flat', id, {
    block: flat.block,
    floor: flat.floor,
    unit_number: flat.unit_number,
  })

  return { newPassword }
}

// ── Audit logs ──────────────────────────────────────────────────────────────

export interface ListAuditLogsFilters {
  page?: string | number
  limit?: string | number
  userId?: string
  action?: string
  entityType?: string
  startDate?: string
  endDate?: string
}

export async function listAuditLogs(db: Db, filters: ListAuditLogsFilters) {
  const { offset, limit } = parsePagination(filters)
  const page = Math.floor(offset / limit) + 1

  const conditions = []
  if (filters.userId) conditions.push(eq(auditLogs.user_id, filters.userId))
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
  if (filters.entityType) conditions.push(eq(auditLogs.entity_type, filters.entityType))
  if (filters.startDate) {
    conditions.push(gte(auditLogs.created_at, new Date(filters.startDate).toISOString()))
  }
  if (filters.endDate) {
    const endDate = new Date(filters.endDate)
    endDate.setHours(23, 59, 59, 999)
    conditions.push(lte(auditLogs.created_at, endDate.toISOString()))
  }
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db.query.auditLogs.findMany({
    where,
    with: { user: { columns: { id: true, name: true, email: true } } },
    orderBy: desc(auditLogs.created_at),
    limit,
    offset,
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(where)

  return paginatedResponse(rows, Number(count), page, limit)
}
