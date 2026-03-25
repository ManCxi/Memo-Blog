const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Page = sequelize.define('Page', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  slug: { type: DataTypes.STRING(200), unique: 'unique_page_slug', allowNull: false },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  status: {
    type: DataTypes.ENUM('published', 'hidden'),
    defaultValue: 'published'
  },
  views: { type: DataTypes.INTEGER, defaultValue: 0 }
});

module.exports = Page;
