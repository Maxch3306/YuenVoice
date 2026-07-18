import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema.js'

// Create a Drizzle client bound to the request's D1 binding. Cheap to construct
// per request — D1 access goes through the binding, there is no connection pool
// to manage (unlike the old pg/Sequelize setup).
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof getDb>
export { schema }
