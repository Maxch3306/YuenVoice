import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import * as userFlatService from '../services/user-flats.js'

// Mounted at /api/users, so paths here are relative (…/me/flats). Every route
// requires a valid access token — these are self-service actions on the
// caller's own account.
const linkBody = z.object({
  block: z.string().min(1),
  floor: z.string().min(1),
  unitNumber: z.string().min(1),
  flatPassword: z.string().min(1),
})
const flatParam = z.object({ flatId: z.string().uuid() })

const userFlats = new Hono<AppBindings>()
userFlats.use('*', requireAuth())

// GET /api/users/me/flats — list every flat owned by the user
userFlats.get('/me/flats', async (c) => {
  const db = getDb(c.env.DB)
  const flats = await userFlatService.listUserFlats(db, c.get('user')!.id)
  return c.json({ data: flats })
})

// POST /api/users/me/flats — claim an additional unit by registration password
userFlats.post('/me/flats', zValidator('json', linkBody), async (c) => {
  const db = getDb(c.env.DB)
  const result = await userFlatService.linkFlat(db, c.get('user')!.id, c.req.valid('json'))
  return c.json(result, 201)
})

// DELETE /api/users/me/flats/:flatId — unlink an additional unit
userFlats.delete('/me/flats/:flatId', zValidator('param', flatParam), async (c) => {
  const db = getDb(c.env.DB)
  await userFlatService.unlinkFlat(db, c.get('user')!.id, c.req.valid('param').flatId)
  return c.body(null, 204)
})

export default userFlats
