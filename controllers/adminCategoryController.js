const { Category, Article } = require('../models');
const { cache } = require('../utils/cache');
const slugify = require('slugify');

function flattenCategoryTree(categoryRows) {
  const byParent = {};
  for (const row of categoryRows) {
    const c = row.toJSON ? row.toJSON() : { ...row };
    const p = c.parentId || 0;
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(c);
  }
  for (const arr of Object.values(byParent)) {
    arr.sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
  }
  const out = [];
  const walk = (pid, depth) => {
    for (const c of byParent[pid] || []) {
      out.push({ id: c.id, name: c.name, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

// 分类列表
exports.index = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['sort', 'ASC'], ['id', 'ASC']], include: [{ association: 'articles', attributes: ['id'] }] });
    res.render('admin/taxonomy/index', {
      title: '分类管理',
      categories,
      categoriesFlat: flattenCategoryTree(categories)
    });
  } catch (err) {
    console.error(err);
    req.session.error = '加载失败';
    res.redirect('/admin');
  }
};

// 新建分类
exports.create = async (req, res) => {
  try {
    const { name, description, sort, parentId } = req.body;
    const isAjax = req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (!name) {
      if (isAjax) return res.json({ ok: false, message: '分类名称不能为空' });
      req.session.error = '分类名称不能为空';
      return res.redirect('/admin/taxonomy');
    }

    const { Op } = require('sequelize');
    const existing = await Category.findOne({ where: { name } });
    if (existing) {
      if (isAjax) return res.json({ ok: false, message: '分类已存在' });
    }

    const slug = slugify(name, { lower: true, strict: true }) || `cat-${Date.now()}`;
    const category = await Category.create({ name, slug, description, sort: parseInt(sort) || 0, parentId: parentId ? parseInt(parentId) : null });

    await cache.del('sidebar:data');
    if (isAjax) return res.json({ ok: true, category });
    req.session.success = '分类创建成功';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    console.error(err);
    const isAjax = req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (isAjax) return res.json({ ok: false, message: err.message });
    req.session.error = '创建失败：' + err.message;
    res.redirect('/admin/taxonomy');
  }
};

// 分类列表 JSON
exports.listApi = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['sort', 'ASC'], ['id', 'ASC']] });
    res.json({ ok: true, categories });
  } catch (err) {
    res.json({ ok: false, message: err.message });
  }
};

// 更新分类
exports.update = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      req.session.error = '分类不存在';
      return res.redirect('/admin/taxonomy');
    }

    const { name, description, sort, parentId } = req.body;
    const slug = slugify(name, { lower: true, strict: true }) || category.slug;
    await category.update({ name, slug, description, sort: parseInt(sort) || 0, parentId: parentId ? parseInt(parentId) : null });

    await cache.del('sidebar:data');
    req.session.success = '分类更新成功';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    console.error(err);
    req.session.error = '更新失败：' + err.message;
    res.redirect('/admin/taxonomy');
  }
};

// 删除分类
exports.destroy = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (category) {
      // 解除文章关联
      await Article.update({ CategoryId: null }, { where: { CategoryId: category.id } });
      await category.destroy();
      await cache.del('sidebar:data');
    }
    req.session.success = '分类已删除';
    res.redirect('/admin/taxonomy');
  } catch (err) {
    console.error(err);
    req.session.error = '删除失败：' + err.message;
    res.redirect('/admin/taxonomy');
  }
};

// 拖拽排序与层级调整
exports.reorder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    for (const it of items) {
      const id = parseInt(it.id);
      const sort = parseInt(it.sort) || 0;
      const parentId = it.parentId ? parseInt(it.parentId) : null;
      await Category.update({ sort, parentId }, { where: { id } });
    }
    await cache.del('sidebar:data');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
