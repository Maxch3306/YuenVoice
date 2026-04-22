import { User, Flat, UserFlat } from '../models/index.js'
import { verifyFlatPassword } from './auth.service.js'

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
export async function getOwnedFlatIds(userId: string): Promise<string[]> {
  const user = await User.findByPk(userId, { attributes: ['flat_id'] })
  const links = await UserFlat.findAll({
    where: { user_id: userId },
    attributes: ['flat_id'],
    order: [['linked_at', 'DESC']],
  })

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
export async function listUserFlats(userId: string): Promise<UserFlatSummary[]> {
  const user = await User.findByPk(userId, {
    attributes: ['flat_id'],
    include: [
      {
        model: Flat,
        as: 'flat',
        attributes: ['id', 'block', 'floor', 'unit_number'],
      },
    ],
  })

  const links = await UserFlat.findAll({
    where: { user_id: userId },
    order: [['linked_at', 'DESC']],
  })

  const linkedFlatIds = links.map((l) => l.flat_id)
  const linkedFlats = linkedFlatIds.length
    ? await Flat.findAll({
        where: { id: linkedFlatIds },
        attributes: ['id', 'block', 'floor', 'unit_number'],
      })
    : []
  const flatById = new Map(linkedFlats.map((f) => [f.id, f]))

  const result: UserFlatSummary[] = []

  const primary = (user as unknown as { flat?: Flat } | null)?.flat ?? null
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
    // Skip if the "linked" row happens to equal the primary (shouldn't occur;
    // we reject it at link time).
    if (primary && flat.id === primary.id) continue
    result.push({
      id: flat.id,
      block: flat.block,
      floor: flat.floor,
      unit_number: flat.unit_number,
      is_primary: false,
      linked_at: link.linked_at.toISOString(),
    })
  }

  return result
}

/**
 * Claim an additional flat for this user by verifying its registration
 * password. Rejects re-claiming the primary or an already-linked flat.
 */
export async function linkFlat(
  userId: string,
  data: {
    block: string
    floor: string
    unitNumber: string
    flatPassword: string
  },
): Promise<UserFlatSummary> {
  const flat = await verifyFlatPassword(data)

  const user = await User.findByPk(userId, { attributes: ['flat_id'] })
  if (user?.flat_id === flat.id) {
    throw Object.assign(new Error('This flat is already your primary unit'), {
      statusCode: 409,
    })
  }

  const existing = await UserFlat.findOne({
    where: { user_id: userId, flat_id: flat.id },
  })
  if (existing) {
    throw Object.assign(new Error('This flat is already linked to your account'), {
      statusCode: 409,
    })
  }

  const link = await UserFlat.create({ user_id: userId, flat_id: flat.id })

  return {
    id: flat.id,
    block: flat.block,
    floor: flat.floor,
    unit_number: flat.unit_number,
    is_primary: false,
    linked_at: link.linked_at.toISOString(),
  }
}

/**
 * Unlink an additional flat. Primary flat cannot be unlinked via this endpoint.
 */
export async function unlinkFlat(userId: string, flatId: string): Promise<void> {
  const user = await User.findByPk(userId, { attributes: ['flat_id'] })
  if (user?.flat_id === flatId) {
    throw Object.assign(new Error('Cannot unlink your primary unit'), {
      statusCode: 400,
    })
  }

  const deleted = await UserFlat.destroy({
    where: { user_id: userId, flat_id: flatId },
  })
  if (deleted === 0) {
    throw Object.assign(new Error('Flat link not found'), { statusCode: 404 })
  }
}
