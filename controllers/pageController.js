const { Page, Category, Tag, Article } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');

// 获取侧边栏数据 (复用逻辑)
async function getSidebarData() {
  const cacheKey = 'sidebar:data';
  let data = await cache.get(cacheKey);
  if (data) return data;

  const [categories, tags, recentArticles, articleCount] = await Promise.all([
    Category.findAll({
      include: [{ association: 'articles', where: { status: 'published' }, required: false }],
      order: [['sort', 'ASC']]
    }),
    Tag.findAll(),
    Article.findAll({
      where: { status: 'published' },
      order: [['views', 'DESC']],
      limit: 10,
      attributes: ['id', 'title', 'slug', 'publishedAt', 'views']
    }),
    Article.count({ where: { status: 'published' } })
  ]);

  data = { categories, tags, recentArticles, articleCount };
  // 填充实时阅读量
  await cache.fillViews(data.recentArticles);
  // 根据实时阅读量再次倒序，取前 5 篇
  data.recentArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
  data.recentArticles = data.recentArticles.slice(0, 5);
  await cache.set(cacheKey, data, CACHE_EXPIRES.SIDEBAR);
  return data;
}

exports.show = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await Page.findOne({
      where: { slug, status: 'published' }
    });

    if (!page) {
      return res.status(404).render('404', { title: '页面不存在' });
    }

    // 更新阅读量
    await Page.increment('views', { where: { id: page.id } });
    const totalViews = (page.views || 0) + 1;

    // 获取侧边栏
    const sidebar = await getSidebarData();

    res.render('page', {
      title: page.title,
      page,
      contentHtml: page.content, // 直接渲染 HTML (编辑器输出的就是 HTML)
      totalViews,
      sidebar
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};
