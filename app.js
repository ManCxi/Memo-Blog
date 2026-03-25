require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override');
const morgan = require('morgan');
const { client: redis, enabled: redisEnabled } = require('./config/redis');
const { sequelize, Article } = require('./models');
const { getSettings } = require('./utils/settings');
const { cache } = require('./utils/cache');
const { UPLOADS_ROOT, ensureUploadsDir } = require('./config/uploadsPath');

const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');

const app = express();

// 视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));
ensureUploadsDir();
app.use('/uploads', express.static(UPLOADS_ROOT));
app.use(express.static(path.join(__dirname, 'public')));

// Session 配置
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'blog-node-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
};

if (redisEnabled && redis) {
  const RedisStore = require('connect-redis').default;
  sessionOptions.store = new RedisStore({ client: redis });
}

app.use(session(sessionOptions));

// 全局变量注入（视图可直接使用）
app.use(async (req, res, next) => {
  res.locals.req = req;
  res.locals.user = req.session.user || null;
  res.locals.flash = {
    success: req.session.success || null,
    error: req.session.error || null
  };
  delete req.session.success;
  delete req.session.error;

  // 注入站点设置（带 1 分钟内存缓存，不会每请求查 DB）
  try {
    const settings = await getSettings();
    res.locals.settings = settings;
    res.locals.siteTitle = settings.site_name || process.env.SITE_TITLE || '我的博客';
    res.locals.siteDescription = settings.site_description || process.env.SITE_DESCRIPTION || '分享技术与生活';
    res.locals.siteKeywords = settings.site_keywords || process.env.SITE_KEYWORDS || '博客,技术,生活';
  } catch {
    res.locals.settings = {};
    res.locals.siteTitle = process.env.SITE_TITLE || '我的博客';
    res.locals.siteDescription = process.env.SITE_DESCRIPTION || '分享技术与生活';
    res.locals.siteKeywords = process.env.SITE_KEYWORDS || '博客,技术,生活';
  }

  next();
});

// 路由
app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/api', apiRouter);

// 404 处理
app.use((req, res) => {
  res.status(404).render('404', { title: '页面不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('404', { title: '服务器错误', message: err.message });
});

// 启动
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    // 尝试同步数据库结构
    // 提示：我们使用了显式的索引名称（如 unique_tag_name）来防止 MySQL 在同步时生成过多重复索引
    try {
      await sequelize.sync({ alter: { drop: false } });
      console.log('✅ 数据库自动更新/完善成功');
    } catch (syncErr) {
      console.warn('⚠️  数据库增量同步时遇到一些限制:', syncErr.message);
      console.log('🔄  尝试基础同步...');
      await sequelize.sync(); // 如果 alter 失败，尝试基础同步
    }

    app.listen(PORT, () => {
      console.log(`🚀 博客系统运行在 http://localhost:${PORT}`);
      console.log(`📝 后台管理：http://localhost:${PORT}/admin`);
      if (!redisEnabled) {
        console.log('⚠️  Redis 已禁用，Session 使用内存存储');
      }
    });

    // 阅读量持久化：每 5 分钟将 Redis 增量同步到数据库
    if (redisEnabled && redis) {
      setInterval(async () => {
        try {
          await cache.syncViews(Article);
        } catch (e) {
          console.error('syncViews error:', e.message);
        }
      }, 5 * 60 * 1000);
    }
  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

start();
