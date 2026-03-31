'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Articles', 'editorType', {
      type: Sequelize.ENUM('html', 'markdown'),
      defaultValue: 'html',
      allowNull: false,
    });
    await queryInterface.addColumn('Pages', 'editorType', {
      type: Sequelize.ENUM('html', 'markdown'),
      defaultValue: 'html',
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Articles', 'editorType');
    await queryInterface.removeColumn('Pages', 'editorType');
    // Note: ENUM types might need special handling depending on the DB (Postgres/MySQL)
    // but removeColumn is usually enough for a simple removal.
  },
};
