const { Page, Category, Tag, Article } = require('../models');
const { cache, CACHE_EXPIRES } = require('../utils/cache');
const { sanitize } = require('../utils/sanitizer');
const { marked } = require('marked');
const { getSidebarData } = require('../services/sidebarService');

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

    // 获取内容解析结果
    let contentHtml = page.content;
    if (page.editorType === 'markdown') {
      contentHtml = marked(page.content);
      contentHtml = sanitize(contentHtml);
    } else if (page.isHtmlCode) {
      // HTML 代码模式：直接输出，跳过 XSS 过滤
      contentHtml = page.content;
    } else {
      contentHtml = sanitize(contentHtml);
    }

    res.render('page', {
      title: page.title,
      page,
      contentHtml,
      totalViews,
      sidebar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('404', { title: '服务器错误' });
  }
};
