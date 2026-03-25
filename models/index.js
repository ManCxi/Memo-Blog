const sequelize = require('../config/database');
const User = require('./User');
const Article = require('./Article');
const Category = require('./Category');
const Tag = require('./Tag');
const Attachment = require('./Attachment');
const Setting = require('./Setting');
const Page = require('./Page');

// 关联关系
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });
Category.hasMany(Article, { foreignKey: 'CategoryId', as: 'articles' });
Article.belongsTo(Category, { foreignKey: 'CategoryId', as: 'category' });

User.hasMany(Article, { foreignKey: 'UserId', as: 'articles' });
Article.belongsTo(User, { foreignKey: 'UserId', as: 'author' });

Article.belongsToMany(Tag, { through: 'ArticleTags', as: 'tags' });
Tag.belongsToMany(Article, { through: 'ArticleTags', as: 'articles' });

module.exports = { sequelize, User, Article, Category, Tag, Attachment, Setting, Page };
