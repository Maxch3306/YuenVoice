import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { userFlats, users } from '../../db/schema.js'
import { HttpError } from '../errors.js'
import { verifyFlatPassword } from './auth.js'

export interface UserFlatSummary {
  id: string
  block: string
  floor: string
  unit_number: string
  is_primary: boolean
  linked_at: string | null
}

/**
 * Resolve every flat id this user owns (primary + linked), in the order
 * primary-first then most-recently-linked first.
 */
export async function getOwnedFlatIds(db: Db, userId: string): Promise<string[]> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { flat_id: true },
  })
  const links = await db
    .select({ flat_id: userFlats.flat_id })
    .from(userFlats)
    .where(eq(userFlats.user_id, userId))
    .orderBy(desc(userFlats.linked_at))

  const ids: string[] = []
  if (user?.flat_id) ids.push(user.flat_id)
  for (const l of links) {
    if (!ids.includes(l.flat_id)) ids.push(l.flat_id)
  }
  return ids
}

/**
 * Return rich flat rows for every unit the user owns, with is_primary flag.
 */
export async function listUserFlats(db: Db, userId: string): Promise<UserFlatSummary[]> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { flat_id: true },
    with: {
      flat: { columns: { id: true, block: true, floor: true, unit_number: true } },
    },
  })

  const links = await db.query.userFlats.findMany({
    where: (uf, { eq }) => eq(uf.user_id, userId),
    orderBy: desc(userFlats.linked_at),
    with: {
      flat: { columns: { id: true, block: true, floor: true, unit_number: true } },
    },
  })

  const result: UserFlatSummary[] = []

  const primary = user?.flat ?? null
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
    const flat = link.flat
    if (!flat) continue
    // Skip if the "linked" row happens to equal the primary (shouldn't occur;
    // we reject it at link time).
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

/**
 * Claim an additional flat for this user by verifying its registration
 * password. Rejects re-claiming the primary or an already-linked flat.
 */
export async function linkFlat(
  db: Db,
  userId: string,
  data: {
    block: string
    floor: string
    unitNumber: string
    flatPassword: string
  },
): Promise<UserFlatSummary> {
  const flat = await verifyFlatPassword(db, data)

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { flat_id: true },
  })
  if (user?.flat_id === flat.id) {
    throw new HttpError(409, 'This flat is already your primary unit')
  }

  const existing = await db.query.userFlats.findFirst({
    where: (uf, { and, eq }) => and(eq(uf.user_id, userId), eq(uf.flat_id, flat.id)),
  })
  if (existing) {
    throw new HttpError(409, 'This flat is already linked to your account')
  }

  const [link] = await db
    .insert(userFlats)
    .values({ user_id: userId, flat_id: flat.id })
    .returning()

  return {
    id: flat.id,
    block: flat.block,
    floor: flat.floor,
    unit_number: flat.unit_number,
    is_primary: false,
    linked_at: link.linked_at,
  }
}

/**
 * Admin unlink: remove any flat from a user's account. Unlike the
 * self-service path, this can also clear the user's primary unit
 * (users.flat_id), e.g. to fix a mistaken registration.
 */
export async function adminUnlinkFlat(db: Db, userId: string, flatId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { id: true, flat_id: true },
  })
  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  if (user.flat_id === flatId) {
    await db.update(users).set({ flat_id: null }).where(eq(users.id, userId))
    // Drop any stray join-table row for the same flat too.
    await db
      .delete(userFlats)
      .where(and(eq(userFlats.user_id, userId), eq(userFlats.flat_id, flatId)))
    return
  }

  const deleted = await db
    .delete(userFlats)
    .where(and(eq(userFlats.user_id, userId), eq(userFlats.flat_id, flatId)))
    .returning({ flat_id: userFlats.flat_id })
  if (deleted.length === 0) {
    throw new HttpError(404, 'Flat link not found')
  }
}

/**
 * Unlink an additional flat. Primary flat cannot be unlinked via this endpoint.
 */
export async function unlinkFlat(db: Db, userId: string, flatId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { flat_id: true },
  })
  if (user?.flat_id === flatId) {
    throw new HttpError(400, 'Cannot unlink your primary unit')
  }

  const deleted = await db
    .delete(userFlats)
    .where(and(eq(userFlats.user_id, userId), eq(userFlats.flat_id, flatId)))
    .returning({ flat_id: userFlats.flat_id })
  if (deleted.length === 0) {
    throw new HttpError(404, 'Flat link not found')
  }
}
