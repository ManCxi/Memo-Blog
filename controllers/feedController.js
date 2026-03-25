const { Article, Category, Page } = require('../models');
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

function plainText(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// RSS 2.0
exports.rss = async (req, res) => {
  try {
    const settings = await getSettings();
    const siteUrl = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const siteName = settings.site_name || '我的博客';
    const siteDesc = settings.site_description || '分享技术与生活';

    const [articles, pages] = await Promise.all([
      Article.findAll({
        where: { status: 'published' },
        order: [['createdAt', 'DESC']],
        limit: 50,
        include: [{ association: 'category', attributes: ['name'] }]
      }),
      Page.findAll({
        where: { status: 'published' },
        order: [['createdAt', 'DESC']],
        limit: 50,
        attributes: ['title', 'slug', 'content', 'createdAt']
      })
    ]);

    const rssItems = [
      ...articles.map(a => ({
        title: a.title,
        link: `${siteUrl}/article/${a.slug}`,
        pubDate: a.createdAt,
        desc: a.summary || plainText(a.content).slice(0, 200),
        category: a.category ? a.category.name : ''
      })),
      ...pages.map(p => ({
        title: p.title,
        link: `${siteUrl}/p/${p.slug}`,
        pubDate: p.createdAt,
        desc: plainText(p.content).slice(0, 200),
        category: '页面'
      }))
    ]
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 50);

    const items = rssItems.map(item => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid>${item.link}</guid>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <description>${escapeXml(item.desc)}</description>
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ''}
    </item>`).join('\n');

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

    const [articles, categories, pages] = await Promise.all([
      Article.findAll({
        where: { status: 'published' },
        attributes: ['slug', 'updatedAt'],
        order: [['updatedAt', 'DESC']]
      }),
      Category.findAll({ attributes: ['slug', 'updatedAt'] }),
      Page.findAll({
        where: { status: 'published' },
        attributes: ['slug', 'updatedAt'],
        order: [['updatedAt', 'DESC']]
      })
    ]);

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

    const pageUrls = pages.map(p => ({
      loc: `${siteUrl}/p/${p.slug}`,
      lastmod: new Date(p.updatedAt).toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.6'
    }));

    const allUrls = [...staticUrls, ...articleUrls, ...categoryUrls, ...pageUrls];

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
