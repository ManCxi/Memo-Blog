const { Article, Category, Tag } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');
const { getSettings } = require('../utils/settings');
const { Op } = require('sequelize');
const { getSidebarData } = require('../services/sidebarService');

const PAGE_SIZE = 10;

// getSidebarData moved to services/sidebarService.js

// 首页 - 文章列表
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const cacheKey = `home:articles:page:${page}`;
    let cached = await cache.get(cacheKey);

    let articles, total;
    if (cached) {
      ({ articles, total } = cached);
    } else {
      const result = await Article.findAndCountAll({
        where: { status: 'published' },
        include: [
          { association: 'category', attributes: ['id', 'name', 'slug'] },
          { association: 'author', attributes: ['id', 'nickname'] },
          { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
        ],
        order: [
          ['pinned', 'DESC'],
          ['publishedAt', 'DESC'],
        ],
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        distinct: true,
      });
      articles = result.rows;
      total = result.count;
      await cache.set(cacheKey, { articles, total }, CACHE_EXPIRES.HOME_ARTICLES);
    }

    // 填充实时阅读量（确保展示的阅读量包含了 Redis 累积的尚未落库的数据）
    await cache.fillViews(articles);

    const sidebar = await getSidebarData();
    const totalPages = Math.ceil(total / PAGE_SIZE);

    res.render('index', {
      title: '首页',
      articles,
      sidebar,
      currentPage: page,
      totalPages,
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误', message: err.message });
  }
};

// 归档页
exports.archive = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const keyword = (req.query.search || '').trim();
    const where = { status: 'published' };
    if (keyword) where.title = { [Op.like]: `%${keyword}%` };

    const result = await Article.findAndCountAll({
      where,
      include: [
        { association: 'category', attributes: ['id', 'name', 'slug'] },
        { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
      ],
      order: [['publishedAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      distinct: true,
    });
    // 归档页也填充实时阅读量
    await cache.fillViews(result.rows);
    const sidebar = await getSidebarData();
    res.render('archive', {
      title: '文章归档',
      articles: result.rows,
      total: result.count,
      keyword,
      sidebar,
      currentPage: page,
      totalPages: Math.ceil(result.count / PAGE_SIZE),
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};

// 友情链接页
exports.linksPage = async (req, res) => {
  try {
    const sidebar = await getSidebarData();
    const settings = await getSettings();
    const links = Array.isArray(settings.friend_links) ? settings.friend_links : [];
    res.render('links', { title: '友情链接', sidebar, links });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};

// 搜索
exports.search = async (req, res) => {
  try {
    const keyword = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;

    if (!keyword) return res.redirect('/');

    const result = await Article.findAndCountAll({
      where: {
        status: 'published',
        [Op.or]: [
          { title: { [Op.like]: `%${keyword}%` } },
          { summary: { [Op.like]: `%${keyword}%` } },
        ],
      },
      include: [
        { association: 'category', attributes: ['id', 'name', 'slug'] },
        { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
      ],
      order: [['publishedAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      distinct: true,
    });
    // 搜索结果页填充实时阅读量
    await cache.fillViews(result.rows);
    const sidebar = await getSidebarData();
    const totalPages = Math.ceil(result.count / PAGE_SIZE);

    res.render('search', {
      title: `搜索：${keyword}`,
      keyword,
      articles: result.rows,
      total: result.count,
      sidebar,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};
