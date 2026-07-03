const { Article, Category, Tag, Attachment, User } = require('../models');
const { cache } = require('../utils/cache');
const slugify = require('slugify');
const { getRelativeUploadPath } = require('../config/uploadsPath');
const path = require('path');
const fs = require('fs');
const { compressImageIfPossible } = require('../services/mediaService');
const { sanitize } = require('../utils/sanitizer');
const { marked } = require('marked');

const PAGE_SIZE = 15;

// Helper to render content (shared with public controller logic)
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

// compressImageIfPossible moved to services/mediaService.js

// 文章列表
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const keyword = req.query.keyword || '';
    const status = req.query.status || '';
    const categoryId = req.query.category || '';

    const { Op } = require('sequelize');
    const where = {};
    if (keyword) where.title = { [Op.like]: `%${keyword}%` };
    if (status) where.status = status;
    if (categoryId) where.CategoryId = parseInt(categoryId);

    const result = await Article.findAndCountAll({
      where,
      include: [{ association: 'category', attributes: ['id', 'name'] }],
      order: [['publishedAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });

    // 填充实时阅读量
    await cache.fillViews(result.rows);

    const categories = await Category.findAll({ order: [['sort', 'ASC']] });

    res.render('admin/articles/index', {
      title: '文章管理',
      articles: result.rows,
      total: result.count,
      categories,
      currentPage: page,
      totalPages: Math.ceil(result.count / PAGE_SIZE),
      keyword,
      status,
      categoryId,
    });
  } catch (err) {
    console.error(err);
    req.session.error = '加载失败：' + err.message;
    res.redirect('/admin');
  }
};

// 新建文章页
exports.createPage = async (req, res) => {
  const categories = await Category.findAll({ order: [['sort', 'ASC']] });
  const tags = await Tag.findAll();
  res.render('admin/articles/form', {
    title: '新建文章',
    article: null,
    categories,
    tags,
    selectedTags: [],
  });
};

// 新建文章保存
exports.create = async (req, res) => {
  try {
    const {
      title,
      content,
      summary,
      CategoryId,
      status,
      pinned,
      tagIds,
      cover,
      publishedAt,
      editorType,
    } = req.body;
    let uploadedCover = '';
    if (req.file) {
      const compressedCover = await compressImageIfPossible(req.file.path, req.file.mimetype);
      const coverPath = compressedCover.filePath || req.file.path;
      uploadedCover = `/uploads/${getRelativeUploadPath(coverPath)}`;
    }

    let slug = slugify(title, { lower: true, strict: true });
    // 如果 slugify 结果为空（例如纯中文标题），则使用时间戳作为 slug
    if (!slug) {
      slug = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }
    // 确保 slug 唯一
    const existing = await Article.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    let finalStatus = 'published';
    if (Array.isArray(status)) {
      finalStatus = status[status.length - 1];
    } else if (status) {
      finalStatus = status;
    }

    const sanitizedContent = editorType === 'markdown' ? content : sanitize(content);
    const article = await Article.create({
      title,
      slug,
      content: sanitizedContent,
      summary:
        sanitize(summary) ||
        (editorType === 'markdown'
          ? content.slice(0, 200)
          : sanitizedContent.slice(0, 200).replace(/<[^>]+>/g, '')),
      cover: cover || uploadedCover,
      CategoryId: CategoryId || null,
      UserId: req.session.user.id,
      status: finalStatus,
      pinned: pinned === 'on' || pinned === '1',
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      editorType: editorType || 'html',
    });

    // 关联标签
    if (tagIds) {
      const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
      await article.setTags(ids.map(Number).filter(Boolean));
    }

    // 清除相关缓存
    await cache.delPattern('home:articles:*');
    await cache.del('sidebar:data');

    req.session.success = '文章发布成功';
    res.redirect('/admin/articles');
  } catch (err) {
    console.error(err);
    const categories = await Category.findAll();
    const tags = await Tag.findAll();
    res.render('admin/articles/form', {
      title: '新建文章',
      article: req.body,
      categories,
      tags,
      selectedTags: [],
      error: '保存失败：' + err.message,
    });
  }
};

// 编辑文章页
exports.editPage = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id, {
      include: [{ association: 'tags', through: { attributes: [] } }],
    });
    if (!article) return res.status(404).render('404', { title: '文章不存在' });

    const categories = await Category.findAll({ order: [['sort', 'ASC']] });
    const tags = await Tag.findAll();
    const selectedTags = article.tags.map((t) => t.id);

    res.render('admin/articles/form', {
      title: '编辑文章',
      article,
      categories,
      tags,
      selectedTags,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/articles');
  }
};

// 更新文章
exports.update = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).send('文章不存在');

    const {
      title,
      content,
      summary,
      CategoryId,
      status,
      pinned,
      tagIds,
      cover,
      publishedAt,
      editorType,
    } = req.body;
    let uploadedCover = '';
    if (req.file) {
      const compressedCover = await compressImageIfPossible(req.file.path, req.file.mimetype);
      const coverPath = compressedCover.filePath || req.file.path;
      uploadedCover = `/uploads/${getRelativeUploadPath(coverPath)}`;
    }

    let finalStatus = 'published';
    if (Array.isArray(status)) {
      finalStatus = status[status.length - 1];
    } else if (status) {
      finalStatus = status;
    }

    const sanitizedContent =
      (editorType || article.editorType) === 'markdown' ? content : sanitize(content);
    const updateData = {
      title,
      content: sanitizedContent,
      summary:
        sanitize(summary) ||
        ((editorType || article.editorType) === 'markdown'
          ? content.slice(0, 200)
          : sanitizedContent.slice(0, 200).replace(/<[^>]+>/g, '')),
      cover: cover || uploadedCover || article.cover,
      CategoryId: CategoryId || null,
      status: finalStatus,
      pinned: pinned === 'on' || pinned === '1',
      editorType: editorType || article.editorType,
    };

    if (publishedAt) {
      updateData.publishedAt = new Date(publishedAt);
    }

    await article.update(updateData);

    if (tagIds !== undefined) {
      const ids = Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : [];
      await article.setTags(ids.map(Number).filter(Boolean));
    } else {
      await article.setTags([]);
    }

    // 清除缓存
    await cache.del(`article:${article.slug}`);
    await cache.delPattern('home:articles:*');
    await cache.del('sidebar:data');

    req.session.success = '文章更新成功';
    res.redirect('/admin/articles');
  } catch (err) {
    console.error(err);
    req.session.error = '更新失败：' + err.message;
    res.redirect(`/admin/articles/${req.params.id}/edit`);
  }
};

// 删除文章
exports.destroy = async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (article) {
      await article.setTags([]);
      await article.destroy();
      await cache.del(`article:${article.slug}`);
      await cache.delPattern('home:articles:*');
      await cache.del('sidebar:data');
    }
    req.session.success = '文章已删除';
    res.redirect('/admin/articles');
  } catch (err) {
    console.error(err);
    req.session.error = '删除失败：' + err.message;
    res.redirect('/admin/articles');
  }
};

// 图片上传
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: '上传失败' });
    const { filename, path: filePath, mimetype, size, originalname } = req.file;
    const displayName = Buffer.from(originalname || filename, 'latin1').toString('utf8');
    const compressed = await compressImageIfPossible(filePath, mimetype);
    const finalPath = compressed.filePath || filePath;
    const urlPath = `/uploads/${getRelativeUploadPath(finalPath)}`;

    // 创建附件记录，确保编辑器上传的文件也能在附件库看到
    const att = await Attachment.create({
      filename: displayName,
      path: urlPath,
      mimetype: compressed.mimetype || 'image/jpeg',
      size: compressed.size || size || 0,
    });

    res.json({ success: true, url: urlPath, id: att.id, filename: displayName });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: '上传失败：' + err.message });
  }
};

// 预览文章 (管理员专供)
exports.preview = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await Article.findByPk(id, {
      include: [
        { association: 'category', attributes: ['id', 'name', 'slug'] },
        { association: 'author', attributes: ['nickname', 'avatar'] },
        { association: 'tags', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
      ],
    });
    if (!article) return res.status(404).render('404', { title: '文章不存在' });

    const contentHtml = renderArticleContent(article.content, article.editorType);
    const { getSidebarData } = require('../services/sidebarService');
    const sidebar = await getSidebarData();

    res.render('article', {
      title: '[预览] ' + article.title,
      article,
      contentHtml,
      totalViews: article.views || 0,
      prevArticle: null,
      nextArticle: null,
      sidebar,
      isPreview: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '预览失败' });
  }
};
