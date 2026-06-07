'use strict'

/**
 * Soft-delete support for user accounts. Admins anonymize + deactivate a user
 * instead of hard-deleting, so their reports/posts/audit history survive while
 * the account is locked out. `deleted_at` marks a row as removed; the admin
 * user list filters these out.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    await queryInterface.addIndex('users', ['deleted_at'], {
      name: 'users_deleted_at_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_deleted_at_idx')
    await queryInterface.removeColumn('users', 'deleted_at')
  },
}
