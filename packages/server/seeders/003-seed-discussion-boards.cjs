'use strict'

const crypto = require('crypto')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Skip if boards already exist
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS count FROM discussion_boards`
    )
    if (Number(existing[0].count) > 0) {
      console.log(`Discussion boards already seeded (${existing[0].count} rows), skipping.`)
      return
    }

    const now = new Date()

    await queryInterface.bulkInsert('discussion_boards', [
      {
        id: crypto.randomUUID(),
        name: 'Estate General / 屋苑綜合討論',
        scope_type: 'estate',
        scope_block: null,
        scope_floor: null,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Block A / A座討論',
        scope_type: 'block',
        scope_block: 'A',
        scope_floor: null,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Block B / B座討論',
        scope_type: 'block',
        scope_block: 'B',
        scope_floor: null,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Block C / C座討論',
        scope_type: 'block',
        scope_block: 'C',
        scope_floor: null,
        created_at: now,
      },
    ])

    console.log('Seeded 4 discussion boards.')
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('discussion_boards', null, {})
  },
}
