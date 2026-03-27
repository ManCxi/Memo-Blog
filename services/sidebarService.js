const { Category, Tag, Article } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');

/**
 * 获取侧边栏数据（带缓存）
 * 包含：分类列表、标签云、热门文章、文章总数
 */
async function getSidebarData() {
  const cacheKey = 'sidebar:data';
  let data = await cache.get(cacheKey);
  if (data) return data;

  const [categories, tags, recentArticles, articleCount] = await Promise.all([
    // 获取分类及其文章计数
    Category.findAll({
      include: [{ association: 'articles', where: { status: 'published' }, required: false }],
      order: [['sort', 'ASC']],
    }),
    // 获取所有标签
    Tag.findAll(),
    // 获取阅读量最高的前 10 篇文章（后续会根据实时阅读量再过滤）
    Article.findAll({
      where: { status: 'published' },
      order: [['views', 'DESC']],
      limit: 10,
      attributes: ['id', 'title', 'slug', 'publishedAt', 'views'],
    }),
    // 获取已发布文章总数
    Article.count({ where: { status: 'published' } }),
  ]);

  data = { categories, tags, recentArticles, articleCount };

  // 填充来自 Redis 的实时阅读量
  if (typeof cache.fillViews === 'function') {
    await cache.fillViews(data.recentArticles);
  }

  // 根据实时阅读量重新排序，取前 5 篇作为“热门文章”
  data.recentArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
  data.recentArticles = data.recentArticles.slice(0, 5);

  // 写入缓存
  await cache.set(cacheKey, data, CACHE_EXPIRES.SIDEBAR);
  return data;
}

module.exports = {
  getSidebarData,
};
