const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define(
  'Setting',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    key: { type: DataTypes.STRING(100), allowNull: false, unique: 'unique_setting_key' },
    value: { type: DataTypes.TEXT('long') },
  },
  {
    tableName: 'Settings',
    freezeTableName: true,
  }
);

module.exports = Setting;
