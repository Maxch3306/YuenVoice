const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') })

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yuenvoice',
    dialect: 'postgres',
  },
  test: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yuenvoice_test',
    dialect: 'postgres',
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
}
