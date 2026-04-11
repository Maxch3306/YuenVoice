'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('flats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      block: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      floor: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      unit_number: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      registration_password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      is_registration_open: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    })

    await queryInterface.addIndex('flats', ['block', 'floor', 'unit_number'], {
      unique: true,
      name: 'flats_block_floor_unit_unique',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('flats')
  },
}
