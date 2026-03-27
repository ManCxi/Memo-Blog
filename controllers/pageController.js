const { Page, Category, Tag, Article } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');
const { getSidebarData } = require('../services/sidebarService');

// getSidebarData moved to services/sidebarService.js

exports.show = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await Page.findOne({
      where: { slug, status: 'published' },
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
      sidebar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};
