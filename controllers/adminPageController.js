const { Page } = require('../models');
const slugify = require('slugify');
const { sanitize } = require('../utils/sanitizer');

const PAGE_SIZE = 15;

// 页面列表
exports.index = async (req, res) => {
  try {
    const p = parseInt(req.query.page) || 1;
    const keyword = req.query.keyword || '';

    const { Op } = require('sequelize');
    const where = {};
    if (keyword) where.title = { [Op.like]: `%${keyword}%` };

    const result = await Page.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (p - 1) * PAGE_SIZE,
    });

    res.render('admin/pages/index', {
      title: '页面管理',
      pages: result.rows,
      total: result.count,
      currentPage: p,
      totalPages: Math.ceil(result.count / PAGE_SIZE),
      keyword,
      activePage: 'pages',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// 新建页面页
exports.createPage = (req, res) => {
  res.render('admin/pages/form', {
    title: '新建页面',
    page: null,
    activePage: 'pages',
  });
};

// 新建页面保存
exports.create = async (req, res) => {
  try {
    let { title, slug, content, status } = req.body;

    if (!slug) {
      slug = slugify(title, { lower: true, strict: true });
    }
    if (!slug) {
      slug = Date.now().toString(36);
    }

    // 检查 slug 唯一性
    const existing = await Page.findOne({ where: { slug } });
    if (existing) {
      return res.render('admin/pages/form', {
        title: '新建页面',
        page: req.body,
        error: 'Slug 已存在，请更换',
        activePage: 'pages',
      });
    }

    await Page.create({ title, slug, content: sanitize(content), status });
    res.redirect('/admin/pages');
  } catch (err) {
    console.error(err);
    res.render('admin/pages/form', {
      title: '新建页面',
      page: req.body,
      error: '保存失败：' + err.message,
      activePage: 'pages',
    });
  }
};

// 编辑页面页
exports.editPage = async (req, res) => {
  try {
    const page = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).send('页面不存在');

    res.render('admin/pages/form', {
      title: '编辑页面',
      page,
      activePage: 'pages',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// 编辑页面更新
exports.update = async (req, res) => {
  try {
    const page = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).send('页面不存在');

    let { title, slug, content, status } = req.body;

    // 检查 slug 唯一性（排除自身）
    const { Op } = require('sequelize');
    const existing = await Page.findOne({
      where: {
        slug,
        id: { [Op.ne]: req.params.id },
      },
    });
    if (existing) {
      return res.render('admin/pages/form', {
        title: '编辑页面',
        page: { ...req.body, id: req.params.id },
        error: 'Slug 已存在，请更换',
        activePage: 'pages',
      });
    }

    await page.update({ title, slug, content: sanitize(content), status });
    res.redirect('/admin/pages');
  } catch (err) {
    console.error(err);
    res.render('admin/pages/form', {
      title: '编辑页面',
      page: { ...req.body, id: req.params.id },
      error: '更新失败：' + err.message,
      activePage: 'pages',
    });
  }
};

// 删除页面
exports.destroy = async (req, res) => {
  try {
    const page = await Page.findByPk(req.params.id);
    if (page) await page.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, message: err.message });
  }
};
