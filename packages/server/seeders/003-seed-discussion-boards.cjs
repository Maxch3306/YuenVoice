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

    const boards = [
      {
        id: crypto.randomUUID(),
        name: 'Estate General / 屋苑綜合討論',
        scope_type: 'estate',
        scope_block: null,
        scope_floor: null,
        created_at: now,
      },
    ]

    for (let block = 1; block <= 6; block++) {
      boards.push({
        id: crypto.randomUUID(),
        name: `Block ${block} / 第${block}座討論`,
        scope_type: 'block',
        scope_block: String(block),
        scope_floor: null,
        created_at: now,
      })
    }

    await queryInterface.bulkInsert('discussion_boards', boards)

    console.log(`Seeded ${boards.length} discussion boards.`)
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('discussion_boards', null, {})
  },
}
