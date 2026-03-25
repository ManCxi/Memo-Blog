const { Article, Category, Tag, Setting, User } = require('../models');
const { cache } = require('../utils/cache');
const { getSettings } = require('../utils/settings');
const slugify = require('slugify');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

exports.getArticles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const categoryId = req.query.categoryId;
    const status = req.query.status;
    const search = req.query.search;

    const where = {};
    if (categoryId) where.CategoryId = parseInt(categoryId);
    if (status) {
      where.status = status === 'PUBLISHED' ? 'published' : status.toLowerCase();
    }
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Article.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['publishedAt', 'DESC']],
      include: [
        { association: 'category' },
        { association: 'tags', through: { attributes: [] } }
      ],
      distinct: true
    });

    // 填充实时阅读量
    await cache.fillViews(rows);

    res.json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id, {
      include: [
        { association: 'category' },
        { association: 'tags', through: { attributes: [] } }
      ]
    });
    if (!article) return res.status(404).json({ error: 'Not found' });
    
    // 填充实时阅读量
    await cache.fillViews(article);

    res.json(article);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const { title, content, summary, cover, status, categoryId, tags } = req.body;
    let slug = slugify(title, { lower: true, strict: true });
    const existing = await Article.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const article = await Article.create({
      title, slug, content, summary, cover,
      status: (status || 'published').toLowerCase(),
      CategoryId: categoryId || null,
      UserId: 1 // 假设 admin
    });

    if (tags && tags.length > 0) {
      // 简单处理，如果是数字字符串则直接关联
      const tagIds = tags.map(Number).filter(n => !isNaN(n));
      await article.setTags(tagIds);
    }
    
    await cache.delPattern('home:articles:*');
    await cache.del('sidebar:data');

    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Not found' });

    const { title, content, summary, cover, status, categoryId, tags } = req.body;
    await article.update({
      title, content, summary, cover,
      status: (status || 'published').toLowerCase(),
      CategoryId: categoryId || null
    });

    if (tags !== undefined) {
      const tagIds = tags.map(Number).filter(n => !isNaN(n));
      await article.setTags(tagIds);
    }

    await cache.delPattern('home:articles:*');
    await cache.del('sidebar:data');
    await cache.del(`article:${article.slug}`);

    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (article) {
      await article.setTags([]);
      await article.destroy();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Categories
exports.getCategories = async (req, res) => {
  const categories = await Category.findAll({ order: [['sort', 'ASC']] });
  res.json(categories);
};
exports.createCategory = async (req, res) => {
  const cat = await Category.create(req.body);
  res.json(cat);
};
exports.updateCategory = async (req, res) => {
  const cat = await Category.findByPk(req.params.id);
  if (cat) await cat.update(req.body);
  res.json(cat);
};
exports.deleteCategory = async (req, res) => {
  const cat = await Category.findByPk(req.params.id);
  if (cat) await cat.destroy();
  res.json({ success: true });
};

// Tags
exports.getTags = async (req, res) => {
  const tags = await Tag.findAll();
  res.json(tags);
};
exports.createTag = async (req, res) => {
  const tag = await Tag.create(req.body);
  res.json(tag);
};
exports.updateTag = async (req, res) => {
  const tag = await Tag.findByPk(req.params.id);
  if (tag) await tag.update(req.body);
  res.json(tag);
};
exports.deleteTag = async (req, res) => {
  const tag = await Tag.findByPk(req.params.id);
  if (tag) await tag.destroy();
  res.json({ success: true });
};

// Settings
exports.getSettings = async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
};
exports.updateSettings = async (req, res) => {
  const data = req.body;
  for (const [key, value] of Object.entries(data)) {
    let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const [setting, created] = await Setting.findOrCreate({
      where: { key },
      defaults: { value: stringValue }
    });
    if (!created) {
      setting.value = stringValue;
      await setting.save();
    }
  }
  await cache.del('site:settings');
  res.json({ success: true });
};

// Auth & Stats
exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user) return res.status(401).json({ error: 'User not found' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: 'mock-token-for-api' });
};

exports.getProfile = async (req, res) => {
  const user = await User.findByPk(1, { attributes: { exclude: ['password'] }});
  res.json(user);
};

exports.updatePassword = async (req, res) => {
  res.json({ success: true });
};

exports.getStats = async (req, res) => {
  const articleCount = await Article.count();
  const categoryCount = await Category.count();
  const tagCount = await Tag.count();
  
  // 总 PV (数据库 + Redis 缓冲)
  let totalPv = await Article.sum('views') || 0;
  const { client: redis, enabled: redisEnabled } = require('../config/redis');
  if (redisEnabled && redis) {
     const keys = await redis.keys('article:view:*');
     if (keys.length > 0) {
       const counts = await redis.mget(...keys);
       const redisTotal = counts.reduce((sum, c) => sum + (parseInt(c) || 0), 0);
       totalPv += redisTotal;
     }
  }

  res.json({ articleCount, categoryCount, tagCount, totalPv });
};
