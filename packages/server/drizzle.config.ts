import { defineConfig } from 'drizzle-kit'

// Generates SQLite migrations into ./drizzle, which `wrangler d1 migrations apply`
// (migrations_dir: "drizzle" in wrangler.jsonc) runs against D1.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
})
