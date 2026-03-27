const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false },
    slug: { type: DataTypes.STRING(50), unique: 'unique_cat_slug' },
    description: { type: DataTypes.TEXT },
    sort: { type: DataTypes.INTEGER, defaultValue: 0 },
    parentId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'Categories',
    freezeTableName: true,
  }
);

module.exports = Category;
