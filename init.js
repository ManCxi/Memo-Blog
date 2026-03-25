/**
 * 初始化脚本
 * 运行: node init.js
 * 功能: 创建数据库表 + 创建默认管理员账号 + 初始化站点设置 + 创建示例内容
 */
require('dotenv').config();
const { sequelize, User, Category, Tag, Article, Setting } = require('./models');

const DEFAULT_SETTINGS = [
  { key: 'site_name', value: JSON.stringify(process.env.SITE_TITLE || '我的博客') },
  { key: 'site_description', value: JSON.stringify(process.env.SITE_DESCRIPTION || '分享技术与生活') },
  { key: 'site_url', value: JSON.stringify('http://localhost:3000') },
  { key: 'site_keywords', value: JSON.stringify(process.env.SITE_KEYWORDS || '博客,技术,生活') },
  { key: 'icp', value: JSON.stringify('') },
  { key: 'copyright', value: JSON.stringify(`© ${new Date().getFullYear()} My Blog. All rights reserved.`) },
  { key: 'run_since', value: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  { key: 'head_code', value: JSON.stringify('') },
  { key: 'google_site_verification', value: JSON.stringify('') },
  { key: 'bing_site_verification', value: JSON.stringify('') },
  { key: 'baidu_site_verification', value: JSON.stringify('') },
  {
    key: 'blogger_info', value: JSON.stringify({
      nickname: '博主',
      avatar: '',
      bio: '热爱技术，热爱生活',
      github: '',
      twitter: '',
      website: ''
    })
  },
  {
    key: 'nav_menus', value: JSON.stringify([
      { id: '1', label: '首页', url: '/', children: [] },
      { id: '2', label: '归档', url: '/archive', children: [] },
      { id: '3', label: '友情链接', url: '/links', children: [] }
    ])
  },
  { key: 'carousel_items', value: JSON.stringify([]) },
  { key: 'friend_links', value: JSON.stringify([]) }
];

async function normalizeMySqlTableNames() {
  if (sequelize.getDialect() !== 'mysql') return;
  const pairs = [
    ['users', 'Users'],
    ['categories', 'Categories'],
    ['tags', 'Tags'],
    ['articles', 'Articles'],
    ['attachments', 'Attachments'],
    ['settings', 'Settings'],
    ['pages', 'Pages'],
    ['articletags', 'ArticleTags']
  ];
  const queryInterface = sequelize.getQueryInterface();
  const allTables = (await queryInterface.showAllTables()).map(t => String(t));
  const [lctnRows] = await sequelize.query('SELECT @@lower_case_table_names AS lctn');
  const lowerCaseTableNames = Number(lctnRows[0] && lctnRows[0].lctn);

  for (const [lower, upper] of pairs) {
    const hasLower = allTables.includes(lower);
    const hasUpper = allTables.includes(upper);
    if (!hasLower) continue;
    if (!hasUpper) {
      if (lowerCaseTableNames !== 0) continue;
      try {
        await sequelize.query(`RENAME TABLE \`${lower}\` TO \`${upper}\``);
      } catch (e) {
        const code = e && e.original && e.original.code;
        if (code === 'ER_TABLE_EXISTS_ERROR') continue;
        throw e;
      }
      continue;
    }
    const [upperCountRows] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${upper}\``);
    const upperCount = Number(upperCountRows[0] && upperCountRows[0].c ? upperCountRows[0].c : 0);
    if (upperCount > 0) continue;
    const upperColumns = Object.keys(await queryInterface.describeTable(upper));
    const lowerColumns = Object.keys(await queryInterface.describeTable(lower));
    const shared = upperColumns.filter(col => lowerColumns.includes(col));
    if (shared.length === 0) continue;
    const columnsSql = shared.map(col => `\`${col}\``).join(', ');
    await sequelize.query(`INSERT IGNORE INTO \`${upper}\` (${columnsSql}) SELECT ${columnsSql} FROM \`${lower}\``);
  }
}

async function init() {
  console.log('🚀 开始初始化博客系统...\n');

  await sequelize.authenticate();
  console.log('✅ 数据库连接成功');
  await normalizeMySqlTableNames();
  try {
    await sequelize.sync({ force: false, alter: true });
  } catch (syncErr) {
    console.warn('⚠️  数据库增量同步时遇到一些限制:', syncErr.message);
    console.log('🔄  尝试基础同步...');
    await sequelize.sync();
  }
  console.log('✅ 数据库表同步完成\n');

  // 创建管理员账号（如果不存在）
  const [admin, created] = await User.findOrCreate({
    where: { username: 'admin' },
    defaults: {
      username: 'admin',
      password: 'admin123456',
      nickname: '博主',
      email: 'admin@blog.com',
      role: 'admin'
    }
  });

  if (created) {
    console.log('✅ 管理员账号创建成功');
    console.log('   用户名: admin');
    console.log('   密  码: admin123456');
    console.log('   ⚠️  请登录后立即修改密码！\n');
  } else {
    console.log('ℹ️  管理员账号已存在，跳过创建\n');
  }

  // 初始化默认设置
  const settingCount = await Setting.count();
  if (settingCount === 0) {
    for (const s of DEFAULT_SETTINGS) {
      await Setting.upsert(s);
    }
    console.log('✅ 默认站点设置初始化完成');
  } else {
    // 仅补充缺失的设置项
    for (const s of DEFAULT_SETTINGS) {
      const exists = await Setting.findOne({ where: { key: s.key } });
      if (!exists) await Setting.create(s);
    }
    console.log('ℹ️  站点设置已存在，已补充缺失项\n');
  }

  // 创建示例分类
  const categoryCount = await Category.count();
  if (categoryCount === 0) {
    const categories = [
      { name: '技术分享', slug: 'tech', description: '编程技术相关文章', sort: 1 },
      { name: '生活随笔', slug: 'life', description: '生活点滴记录', sort: 2 },
      { name: '读书笔记', slug: 'books', description: '阅读心得分享', sort: 3 }
    ];
    await Category.bulkCreate(categories);
    console.log('✅ 示例分类创建完成');
  }

  // 创建示例标签
  const tagCount = await Tag.count();
  if (tagCount === 0) {
    const tags = [
      { name: 'Node.js', slug: 'nodejs' },
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'Express', slug: 'express' },
      { name: 'Redis', slug: 'redis' },
      { name: 'MySQL', slug: 'mysql' }
    ];
    await Tag.bulkCreate(tags);
    console.log('✅ 示例标签创建完成');
  }

  // 创建示例文章
  const articleCount = await Article.count();
  if (articleCount === 0) {
    const techCategory = await Category.findOne({ where: { slug: 'tech' } });
    const article = await Article.create({
      title: '欢迎使用本博客系统',
      slug: 'welcome',
      content: `# 欢迎使用本博客系统

这是一篇示例文章，欢迎你使用这套博客系统！

## 技术栈

本博客系统基于以下技术栈构建：

- **Node.js + Express** - 服务端框架
- **EJS** - 模板引擎（服务端渲染，前后台不分离）
- **Sequelize ORM** - 支持 SQLite / MySQL / PostgreSQL 三种数据库
- **Redis** - 缓存 + 会话存储（可选）

## 核心特性

1. 多数据库支持，一键切换（仅需修改 \`.env\` 配置）
2. Redis 缓存加速，阅读量高并发计数
3. 支持 Markdown 写作（含代码高亮、数学公式、Mermaid 图表）
4. 文章目录（TOC）自动生成
5. 暗黑模式
6. 附件库管理
7. 站点设置（导航菜单、轮播图、友链等）

## 开始使用

访问 [后台管理](/admin)，使用初始账号登录：

- 用户名：\`admin\`
- 密码：\`admin123456\`

> 请登录后立即修改密码！

\`\`\`javascript
// 示例代码
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello Blog!'));
app.listen(3000);
\`\`\`

祝写作愉快！🎉`,
      summary: '欢迎使用本博客系统！这是一篇示例文章，介绍了系统的技术栈和核心特性。',
      CategoryId: techCategory ? techCategory.id : null,
      UserId: admin.id,
      status: 'published',
      pinned: true,
      views: 0
    });

    const tags = await Tag.findAll({ limit: 3 });
    await article.setTags(tags);
    console.log('✅ 示例文章创建完成');
  }

  const carouselSetting = await Setting.findOne({ where: { key: 'carousel_items' } });
  let carouselItems = [];
  if (carouselSetting) {
    try {
      carouselItems = JSON.parse(carouselSetting.value);
    } catch {
      carouselItems = [];
    }
  }
  if (!Array.isArray(carouselItems) || carouselItems.length === 0) {
    const publishedArticles = await Article.findAll({
      where: { status: 'published' },
      attributes: ['title', 'slug', 'summary', 'cover'],
      order: [['pinned', 'DESC'], ['createdAt', 'DESC']],
      limit: 5
    });
    const nextCarouselItems = publishedArticles.map(a => ({
      title: a.title || '',
      subtitle: a.summary || '',
      url: `/article/${a.slug}`,
      image: a.cover || ''
    }));
    if (nextCarouselItems.length > 0) {
      await Setting.upsert({ key: 'carousel_items', value: JSON.stringify(nextCarouselItems) });
      console.log('✅ 默认轮播图初始化完成');
    }
  }

  console.log('\n🎉 初始化完成！');
  console.log('▶️  运行 npm start 启动服务');
  console.log('🌐 前台地址: http://localhost:3000');
  console.log('🔧 后台地址: http://localhost:3000/admin\n');

  process.exit(0);
}

init().catch(err => {
  console.error('❌ 初始化失败:', err);
  process.exit(1);
});
