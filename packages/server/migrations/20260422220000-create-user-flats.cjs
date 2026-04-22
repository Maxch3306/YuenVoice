'use strict'

/**
 * Owners that possess more than one unit can link additional flats to their
 * account. The primary flat stays on users.flat_id (set at registration); this
 * join table stores each additional claimed flat.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_flats', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      flat_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'flats', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      linked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    })

    await queryInterface.addIndex('user_flats', ['user_id'], {
      name: 'user_flats_user_id_idx',
    })
    await queryInterface.addIndex('user_flats', ['flat_id'], {
      name: 'user_flats_flat_id_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_flats')
  },
}
