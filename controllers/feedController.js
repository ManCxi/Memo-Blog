const { Article, Category } = require('../models');
const { getSettings } = require('../utils/settings');

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// RSS 2.0
exports.rss = async (req, res) => {
  try {
    const settings = await getSettings();
    const siteUrl = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const siteName = settings.site_name || '我的博客';
    const siteDesc = settings.site_description || '分享技术与生活';

    const articles = await Article.findAll({
      where: { status: 'published' },
      order: [['createdAt', 'DESC']],
      limit: 50,
      include: [{ association: 'category', attributes: ['name'] }]
    });

    const items = articles.map(a => {
      const link = `${siteUrl}/article/${a.slug}`;
      const pubDate = new Date(a.createdAt).toUTCString();
      const desc = escapeXml(a.summary || a.content.slice(0, 200));
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      ${a.category ? `<category>${escapeXml(a.category.name)}</category>` : ''}
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('生成 RSS 失败');
  }
};

// Sitemap XML
exports.sitemap = async (req, res) => {
  try {
    const settings = await getSettings();
    const siteUrl = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const articles = await Article.findAll({
      where: { status: 'published' },
      attributes: ['slug', 'updatedAt'],
      order: [['updatedAt', 'DESC']]
    });

    const categories = await Category.findAll({ attributes: ['slug', 'updatedAt'] });

    const staticUrls = ['/', '/archive', '/links'].map(p => ({
      loc: siteUrl + p,
      changefreq: p === '/' ? 'daily' : 'weekly',
      priority: p === '/' ? '1.0' : '0.8'
    }));

    const articleUrls = articles.map(a => ({
      loc: `${siteUrl}/article/${a.slug}`,
      lastmod: new Date(a.updatedAt).toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.7'
    }));

    const categoryUrls = categories.map(c => ({
      loc: `${siteUrl}/category/${c.slug}`,
      changefreq: 'weekly',
      priority: '0.6'
    }));

    const allUrls = [...staticUrls, ...articleUrls, ...categoryUrls];

    const urlTags = allUrls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlTags}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('生成 Sitemap 失败');
  }
};
