'use strict'

/**
 * Adds external link support to oc_documents so that meeting livestreams
 * (Google Meet), recordings (Google Drive) and financial sites (Google
 * Sites/Drive) can be published alongside uploaded PDFs.
 *
 * - Makes file_path nullable (a document may be a link instead)
 * - Adds external_url + link_type (nullable)
 * - Extends the type enum with meeting_livestream + meeting_recording
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('oc_documents', 'file_path', {
      type: Sequelize.STRING,
      allowNull: true,
    })

    await queryInterface.addColumn('oc_documents', 'external_url', {
      type: Sequelize.STRING(1024),
      allowNull: true,
    })

    await queryInterface.addColumn('oc_documents', 'link_type', {
      type: Sequelize.ENUM('google_meet', 'google_drive', 'google_site'),
      allowNull: true,
    })

    // Postgres: extend existing enum_oc_documents_type with new values
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_oc_documents_type ADD VALUE IF NOT EXISTS 'meeting_livestream'"
    )
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_oc_documents_type ADD VALUE IF NOT EXISTS 'meeting_recording'"
    )
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('oc_documents', 'link_type')
    await queryInterface.removeColumn('oc_documents', 'external_url')

    // Postgres cannot drop enum values cleanly; leave the extended type in
    // place on down-migration (rows using the new values would have to be
    // cleared manually first).
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS enum_oc_documents_link_type'
    )

    await queryInterface.changeColumn('oc_documents', 'file_path', {
      type: require('sequelize').STRING,
      allowNull: false,
    })
  },
}
