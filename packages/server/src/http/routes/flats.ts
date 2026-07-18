import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { flats as flatsTable } from '../../db/schema.js'

// Public flat-lookup endpoints used by registration + report location pickers.
// No auth (matches the previous inline endpoints in app.ts).
const flats = new Hono<AppBindings>()

flats.get('/blocks', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db
    .selectDistinct({ block: flatsTable.block })
    .from(flatsTable)
    .orderBy(asc(flatsTable.block))
  return c.json(rows.map((r) => r.block))
})

flats.get('/floors', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.selectDistinct({ floor: flatsTable.floor }).from(flatsTable)
  return c.json(rows.map((r) => r.floor).sort((a, b) => Number(a) - Number(b)))
})

flats.get('/units', async (c) => {
  const db = getDb(c.env.DB)
  const block = c.req.query('block')
  const floor = c.req.query('floor')
  const conditions = []
  if (block) conditions.push(eq(flatsTable.block, block))
  if (floor) conditions.push(eq(flatsTable.floor, floor))
  const rows = await db
    .selectDistinct({ unit_number: flatsTable.unit_number })
    .from(flatsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(flatsTable.unit_number))
  return c.json(rows.map((r) => r.unit_number))
})

export default flats
