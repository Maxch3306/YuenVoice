'use strict'

/**
 * Individual reminders: the management office can push a notification to a
 * single user. Adds a 'user' value to the notification target enum and a
 * nullable target_user_id column pointing at the recipient.
 *
 * Note: PostgreSQL cannot drop a single value from an enum in place, so the
 * down migration rebuilds enum_notifications_target_type from scratch.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_notifications_target_type" ADD VALUE IF NOT EXISTS 'user'`,
    )

    await queryInterface.addColumn('notifications', 'target_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.addIndex('notifications', ['target_user_id'], {
      name: 'notifications_target_user_id_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'notifications',
      'notifications_target_user_id_idx',
    )
    await queryInterface.removeColumn('notifications', 'target_user_id')

    // Rebuild the enum without 'user' (PG can't remove a single enum value).
    await queryInterface.sequelize.query(`
      ALTER TABLE "notifications" ALTER COLUMN "target_type" TYPE text;
      DROP TYPE "enum_notifications_target_type";
      CREATE TYPE "enum_notifications_target_type" AS ENUM ('all', 'block', 'floor');
      ALTER TABLE "notifications"
        ALTER COLUMN "target_type" TYPE "enum_notifications_target_type"
        USING ("target_type"::"enum_notifications_target_type");
    `)
  },
}
