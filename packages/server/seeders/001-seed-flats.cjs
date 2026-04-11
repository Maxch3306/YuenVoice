'use strict'

const crypto = require('crypto')

function generatePassword() {
  // 8-char alphanumeric password (uppercase + digits, no ambiguous chars I/O/0/1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let pw = ''
  for (let i = 0; i < 8; i++) {
    pw += chars[bytes[i] % chars.length]
  }
  return pw
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Skip if flats already exist
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS count FROM flats`
    )
    if (Number(existing[0].count) > 0) {
      console.log(`Flats already seeded (${existing[0].count} rows), skipping.`)
      return
    }

    const blocks = ['1', '2', '3', '4', '5', '6']
    const floors = Array.from({ length: 35 }, (_, i) => String(i + 1))
    const units = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']

    const flats = []
    const now = new Date()

    for (const block of blocks) {
      for (const floor of floors) {
        for (const unit of units) {
          const rawPassword = generatePassword()

          flats.push({
            id: crypto.randomUUID(),
            block,
            floor,
            unit_number: unit,
            registration_password: rawPassword,
            is_registration_open: true,
            created_at: now,
            updated_at: now,
          })
        }
      }
    }

    // Insert in batches of 100
    for (let i = 0; i < flats.length; i += 100) {
      await queryInterface.bulkInsert('flats', flats.slice(i, i + 100))
    }

    console.log(`Seeded ${flats.length} flats.`)
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('flats', null, {})
  },
}
