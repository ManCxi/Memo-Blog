const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Article = sequelize.define('Article', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  slug: { type: DataTypes.STRING(200), unique: 'unique_article_slug' },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  summary: { type: DataTypes.TEXT },
  cover: { type: DataTypes.STRING(200) },
  status: {
    type: DataTypes.ENUM('published', 'draft'),
    defaultValue: 'published'
  },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  publishedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Articles',
  freezeTableName: true
});

module.exports = Article;
