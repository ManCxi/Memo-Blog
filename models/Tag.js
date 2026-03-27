const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tag = sequelize.define(
  'Tag',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: 'unique_tag_name' },
    slug: { type: DataTypes.STRING(50), unique: 'unique_tag_slug' },
  },
  {
    tableName: 'Tags',
    freezeTableName: true,
  }
);

module.exports = Tag;
