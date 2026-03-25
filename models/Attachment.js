const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attachment = sequelize.define('Attachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  filename: { type: DataTypes.STRING(255), allowNull: false },
  path: { type: DataTypes.STRING(500), allowNull: false },
  mimetype: { type: DataTypes.STRING(100), defaultValue: 'application/octet-stream' },
  size: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'Attachments',
  freezeTableName: true,
  updatedAt: false
});

module.exports = Attachment;
