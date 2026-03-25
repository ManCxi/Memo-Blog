const sequelize = require('../config/database');
const User = require('./User');
const Article = require('./Article');
const Category = require('./Category');
const Tag = require('./Tag');
const Attachment = require('./Attachment');
const Setting = require('./Setting');
const Page = require('./Page');

// 关联关系
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId', constraints: false });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId', constraints: false });
Category.hasMany(Article, { foreignKey: 'CategoryId', as: 'articles', constraints: false });
Article.belongsTo(Category, { foreignKey: 'CategoryId', as: 'category', constraints: false });

User.hasMany(Article, { foreignKey: 'UserId', as: 'articles', constraints: false });
Article.belongsTo(User, { foreignKey: 'UserId', as: 'author', constraints: false });

Article.belongsToMany(Tag, { through: 'ArticleTags', as: 'tags', constraints: false });
Tag.belongsToMany(Article, { through: 'ArticleTags', as: 'articles', constraints: false });

module.exports = { sequelize, User, Article, Category, Tag, Attachment, Setting, Page };
