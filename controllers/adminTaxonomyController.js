const { Category, Tag } = require('../models');
const { cache } = require('../utils/cache');

function flattenCategoryTree(categoryRows) {
  const byParent = {};
  for (const row of categoryRows) {
    const c = row.toJSON ? row.toJSON() : { ...row };
    const p = c.parentId || 0;
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(c);
  }
  for (const arr of Object.values(byParent)) {
    arr.sort((a, b) => a.sort - b.sort || a.id - b.id);
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

exports.index = async (req, res) => {
  try {
    const [categories, tags] = await Promise.all([
      Category.findAll({
        order: [
          ['sort', 'ASC'],
          ['id', 'ASC'],
        ],
        include: [{ association: 'articles', attributes: ['id'] }],
      }),
      Tag.findAll({
        order: [['name', 'ASC']],
        include: [{ association: 'articles', attributes: ['id'], through: { attributes: [] } }],
      }),
    ]);

    res.render('admin/taxonomy/index', {
      title: '分类/标签管理',
      categories,
      categoriesFlat: flattenCategoryTree(categories),
      tags,
    });
  } catch (err) {
    console.error(err);
    req.session.error = '加载失败';
    res.redirect('/admin');
  }
};
