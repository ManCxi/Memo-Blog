const { Tag } = require('../models');
const { cache } = require('../utils/cache');
const slugify = require('slugify');

// 标签列表
exports.index = async (req, res) => {
  try {
    const tags = await Tag.findAll({
      order: [['name', 'ASC']],
      include: [{ association: 'articles', attributes: ['id'], through: { attributes: [] } }],
    });
    res.render('admin/taxonomy/index', { title: '标签管理', tags });
  } catch (err) {
    console.error(err);
    req.session.error = '加载失败';
    res.redirect('/admin');
  }
};

// 新建标签
exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    const isAjax = req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (!name) {
      if (isAjax) return res.json({ ok: false, message: '标签名称不能为空' });
      req.session.error = '标签名称不能为空';
      return res.redirect('/admin/taxonomy');
    }

    const existing = await Tag.findOne({ where: { name } });
    if (existing) {
      if (isAjax) return res.json({ ok: true, tag: existing }); // Already exists, return it
    }

    const slug = slugify(name, { lower: true, strict: true }) || `tag-${Date.now()}`;
    const tag = await Tag.create({ name, slug });

    await cache.del('sidebar:data');
    if (isAjax) return res.json({ ok: true, tag });
    req.session.success = '标签创建成功';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    console.error(err);
    const isAjax = req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (isAjax) return res.json({ ok: false, message: '创建失败（标签可能已存在）' });
    req.session.error = '创建失败（标签可能已存在）';
    res.redirect('/admin/taxonomy');
  }
};

// 标签列表 JSON
exports.listApi = async (req, res) => {
  try {
    const tags = await Tag.findAll({ order: [['name', 'ASC']] });
    res.json({ ok: true, tags });
  } catch (err) {
    res.json({ ok: false, message: err.message });
  }
};

// 更新标签
exports.update = async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    if (!tag) {
      req.session.error = '标签不存在';
      return res.redirect('/admin/taxonomy');
    }
    const { name } = req.body;
    const slug = slugify(name, { lower: true, strict: true }) || tag.slug;
    await tag.update({ name, slug });

    await cache.del('sidebar:data');
    req.session.success = '标签更新成功';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    req.session.error = '更新失败：' + err.message;
    res.redirect('/admin/taxonomy');
  }
};

// 删除标签
exports.destroy = async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    if (tag) {
      await tag.setArticles([]);
      await tag.destroy();
      await cache.del('sidebar:data');
    }
    req.session.success = '标签已删除';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    req.session.error = '删除失败：' + err.message;
    res.redirect('/admin/taxonomy');
  }
};
