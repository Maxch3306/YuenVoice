import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildApp } from './app.js'
import { config } from './config/index.js'
import { sequelize } from './models/index.js'
import { ensureAdminAccount } from './utils/setup.js'
import { Umzug, SequelizeStorage } from 'umzug'
import { validateEnv } from './utils/env-validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const migrationsPath = path.resolve(__dirname, '..', 'migrations')
const seedersPath = path.resolve(__dirname, '..', 'seeders')

// Migration runner — tracked via "SequelizeMeta" table
const migrator = new Umzug({
  migrations: {
    glob: path.join(migrationsPath, '*.cjs').replace(/\\/g, '/'),
    resolve: ({ name, path: migrationPath }) => {
      const migration = require(migrationPath!)
      return {
        name,
        up: async () => migration.up(sequelize.getQueryInterface(), sequelize.constructor),
        down: async () => migration.down(sequelize.getQueryInterface(), sequelize.constructor),
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
})

// Seed runner — tracked via "SequelizeSeederMeta" table (won't re-run already executed seeds)
const seeder = new Umzug({
  migrations: {
    glob: path.join(seedersPath, '*.cjs').replace(/\\/g, '/'),
    resolve: ({ name, path: seedPath }) => {
      const seed = require(seedPath!)
      return {
        name,
        up: async () => seed.up(sequelize.getQueryInterface(), sequelize.constructor),
        down: async () => seed.down(sequelize.getQueryInterface(), sequelize.constructor),
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeSeederMeta' }),
  logger: console,
})

async function start() {
  // Validate environment variables before anything else
  validateEnv()

  const app = await buildApp()

  try {
    // 1. Connect to database
    await sequelize.authenticate()
    app.log.info('Database connection established')

    // 2. Run pending migrations (step by step)
    const pendingMigrations = await migrator.pending()
    if (pendingMigrations.length > 0) {
      app.log.info(`Running ${pendingMigrations.length} pending migration(s)...`)
      await migrator.up()
      app.log.info('All migrations executed successfully')
    } else {
      app.log.info('Database is up to date — no pending migrations')
    }

    // 3. Run pending seeds (step by step, tracked so they don't re-run)
    const pendingSeeds = await seeder.pending()
    if (pendingSeeds.length > 0) {
      app.log.info(`Running ${pendingSeeds.length} pending seed(s)...`)
      await seeder.up()
      app.log.info('All seeds executed successfully')
    }

    // 4. Ensure admin account exists (from .env config, idempotent)
    await ensureAdminAccount()

    // 5. Start server
    await app.listen({ port: config.port, host: '0.0.0.0' })
    app.log.info(`Server listening on http://localhost:${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
