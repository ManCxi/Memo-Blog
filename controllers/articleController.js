const { Article, Category, Tag } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');
const { enabled: redisEnabled } = require('../config/redis');
const { marked } = require('marked');
const { getSidebarData } = require('../services/sidebarService');
const { sanitize } = require('../utils/sanitizer');

const PAGE_SIZE = 10;

function renderArticleContent(content, editorType) {
  const raw = String(content || '');
  if (!raw.trim()) return '';

  let html = '';
  if (editorType === 'markdown') {
    html = marked(raw);
  } else {
    const hasRichHtml =
      /<\/?(p|div|h[1-6]|pre|code|blockquote|ul|ol|li|table|thead|tbody|tr|td|th|img|figure|span|br)\b/i.test(
        raw
      );
    html = hasRichHtml ? raw : marked(raw);
  }
  return sanitize(html);
}

// getSidebarData moved to services/sidebarService.js

// 文章详情
exports.show = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `article:${slug}`;
    let article = await cache.get(cacheKey);

    if (!article) {
      article = await Article.findOne({
        where: { slug, status: 'published' },
        include: [
          { association: 'category', attributes: ['id', 'name', 'slug'] },
          { association: 'author', attributes: ['id', 'nickname', 'avatar'] },
          { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
        ],
      });
      if (!article) return res.status(404).render('404', { title: '文章不存在' });
      await cache.set(cacheKey, article, CACHE_EXPIRES.ARTICLE_DETAIL);
    }

    // 阅读量 +1
    let totalViews = article.views || 0;
    if (redisEnabled) {
      await cache.incrView(article.id);
      const extraViews = await cache.getView(article.id);
      totalViews += extraViews;
    } else {
      await Article.increment('views', { where: { id: article.id } });
      totalViews += 1;
    }

    // 内容转 HTML（优先根据 editorType，旧数据回退到启发式）
    const contentHtml = renderArticleContent(article.content, article.editorType);

    // 上一篇/下一篇
    const { Op } = require('sequelize');
    const [prevArticle, nextArticle] = await Promise.all([
      Article.findOne({
        where: { status: 'published', id: { [Op.lt]: article.id } },
        order: [['id', 'DESC']],
        attributes: ['id', 'title', 'slug'],
      }).catch(() => null),
      Article.findOne({
        where: { status: 'published', id: { [Op.gt]: article.id } },
        order: [['id', 'ASC']],
        attributes: ['id', 'title', 'slug'],
      }).catch(() => null),
    ]);

    const sidebar = await getSidebarData();

    res.render('article', {
      title: article.title,
      article,
      contentHtml,
      totalViews,
      prevArticle,
      nextArticle,
      sidebar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};

// 分类页
exports.category = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;

    // 支持 /category/all 展示全部文章
    const isAll = slug === 'all';
    let category = null;
    if (!isAll) {
      category = await Category.findOne({ where: { slug } });
      if (!category) return res.status(404).render('404', { title: '分类不存在' });
    }

    const where = { status: 'published' };
    if (!isAll && category) where.CategoryId = category.id;

    const result = await Article.findAndCountAll({
      where,
      include: [
        { association: 'category', attributes: ['id', 'name', 'slug'] },
        { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      distinct: true,
    });

    // 填充实时阅读量
    await cache.fillViews(result.rows);

    const sidebar = await getSidebarData();
    const totalPages = Math.ceil(result.count / PAGE_SIZE);

    res.render('taxonomy', {
      title: isAll ? '全部文章' : `分类：${category.name}`,
      taxonomyType: 'category',
      taxonomyName: isAll ? '全部文章' : category.name,
      taxonomyDesc: isAll ? null : category.description,
      taxonomySlug: isAll ? 'all' : category.slug,
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

// 标签页
exports.tag = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;

    const tag = await Tag.findOne({ where: { slug } });
    if (!tag) return res.status(404).render('404', { title: '标签不存在' });

    const result = await Article.findAndCountAll({
      where: { status: 'published' },
      include: [
        {
          association: 'tags',
          where: { id: tag.id },
          attributes: ['id', 'name', 'slug'],
          through: { attributes: [] },
        },
        { association: 'category', attributes: ['id', 'name', 'slug'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      distinct: true,
    });

    // 填充实时阅读量
    await cache.fillViews(result.rows);

    const sidebar = await getSidebarData();
    const totalPages = Math.ceil(result.count / PAGE_SIZE);

    res.render('taxonomy', {
      title: `标签：${tag.name}`,
      taxonomyType: 'tag',
      taxonomyName: tag.name,
      taxonomyDesc: null,
      taxonomySlug: tag.slug,
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
