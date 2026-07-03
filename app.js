const env = require('./config/env');
const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const { DataTypes } = require('sequelize');
const { client: redis, enabled: redisEnabled } = require('./config/redis');
const { sequelize, Article } = require('./models');
const { getSettings } = require('./utils/settings');
const { cache } = require('./utils/cache');
const { UPLOADS_ROOT, ensureUploadsDir } = require('./config/uploadsPath');

const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');

const app = express();
const trustProxyRaw = env.TRUST_PROXY;
const trustProxy =
  typeof trustProxyRaw === 'string' && trustProxyRaw.trim() !== ''
    ? trustProxyRaw === 'true'
      ? true
      : trustProxyRaw === 'false'
        ? false
        : Number.isNaN(Number(trustProxyRaw))
          ? trustProxyRaw
          : Number(trustProxyRaw)
    : env.NODE_ENV === 'production'
      ? 1
      : false;
app.set('trust proxy', trustProxy);

// 安全中间件
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 根据富文本编辑器的需求调整
        'script-src-attr': ["'unsafe-inline'"], // 允许 inline event handlers (onclick 等)
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  })
);

// 登录接口限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10, // 限制 10 次
  message: '登录尝试次数过多，请 15 分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/admin/login', loginLimiter);
app.use('/api/auth/login', loginLimiter);

// 视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(cookieParser());
const csrfProtection = csrf({ cookie: false }); // use session instead of cookie for csrf
ensureUploadsDir();
app.use('/uploads', express.static(UPLOADS_ROOT));
app.use(express.static(path.join(__dirname, 'public')));

// Session 配置
const sessionOptions = {
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: trustProxy ? true : undefined,
  name: 'blog.sid',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  },
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
    error: req.session.error || null,
  };
  delete req.session.success;
  delete req.session.error;

  // 注入站点设置（带 1 分钟内存缓存，不会每请求查 DB）
  try {
    const settings = await getSettings();
    res.locals.settings = settings;
    res.locals.siteTitle = settings.site_name || process.env.SITE_TITLE || '我的博客';
    res.locals.siteDescription =
      settings.site_description || process.env.SITE_DESCRIPTION || '分享技术与生活';
    res.locals.siteKeywords =
      settings.site_keywords || process.env.SITE_KEYWORDS || '博客,技术,生活';
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
app.use(
  '/admin',
  (req, res, next) => {
    // 对 GET 请求总是启用，以便注入 token
    if (req.method === 'GET') return csrfProtection(req, res, next);
    // 对非 GET 的 multipart 且非 AJAX 请求，跳过全局验证，由路由内部在 multer 后验证
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data') && !req.xhr && !req.headers['x-csrf-token']) {
      return next();
    }
    csrfProtection(req, res, next);
  },
  (req, res, next) => {
    if (typeof req.csrfToken === 'function') {
      res.locals.csrfToken = req.csrfToken();
    }
    next();
  },
  adminRouter
);
app.use('/api', apiRouter);
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// 404 处理
app.use((req, res) => {
  res.status(404).render('404', { title: '页面不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  let status = err.status || 500;
  let message = err.message;
  if (err.code === 'EBADCSRFTOKEN') {
    status = 403;
    message = '表单已过期，请刷新后重试';
  }
  if (err.code === 'LIMIT_FIELD_VALUE') {
    status = 400;
    message = '提交内容过大，请精简正文或减少一次性粘贴内容后重试';
  }
  res
    .status(status)
    .render('404', { title: status === 403 ? '请求被拒绝' : '服务器错误', message });
});

// 启动
const PORT = process.env.PORT || 3000;

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
    ['articletags', 'ArticleTags'],
  ];
  const queryInterface = sequelize.getQueryInterface();
  const allTables = (await queryInterface.showAllTables()).map((t) => String(t));
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
    const shared = upperColumns.filter((col) => lowerColumns.includes(col));
    if (shared.length === 0) continue;
    const columnsSql = shared.map((col) => `\`${col}\``).join(', ');
    await sequelize.query(
      `INSERT IGNORE INTO \`${upper}\` (${columnsSql}) SELECT ${columnsSql} FROM \`${lower}\``
    );
  }
}

async function ensureEditorTypeColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const targets = ['Articles', 'Pages'];
  for (const tableName of targets) {
    const columns = await queryInterface.describeTable(tableName).catch(() => null);
    if (!columns || columns.editorType) continue;
    await queryInterface.addColumn(tableName, 'editorType', {
      type: DataTypes.ENUM('html', 'markdown'),
      defaultValue: 'html',
      allowNull: false,
    });
    console.log(`✅ 已补齐字段: ${tableName}.editorType`);
  }
}

async function ensureIsHtmlCodeColumn() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('Pages').catch(() => null);
  if (!columns || columns.isHtmlCode) return;
  await queryInterface.addColumn('Pages', 'isHtmlCode', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  });
  console.log('✅ 已补齐字段: Pages.isHtmlCode');
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    await normalizeMySqlTableNames();
    await ensureEditorTypeColumns();
    await ensureIsHtmlCodeColumn();
    // 尝试同步数据库结构 (仅在开发环境或明确要求时)
    if (process.env.NODE_ENV !== 'production' || process.env.DB_SYNC === 'true') {
      try {
        await sequelize.sync({ alter: { drop: false } });
        console.log('✅ 数据库自动更新/完善成功');
      } catch (syncErr) {
        console.warn('⚠️  数据库增量同步时遇到一些限制:', syncErr.message);
        console.log('🔄  尝试基础同步...');
        await sequelize.sync(); // 如果 alter 失败，尝试基础同步
      }
    } else {
      console.log('ℹ️  生产环境跳过自动建表/改表，请使用 migration');
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
      setInterval(
        async () => {
          try {
            await cache.syncViews(Article);
          } catch (e) {
            console.error('syncViews error:', e.message);
          }
        },
        5 * 60 * 1000
      );
    }
  } catch (err) {
    console.error('❌ 启动失败:', err);
    if (err && (err.name === 'SequelizeConnectionError' || err.original)) {
      const dialect = process.env.DB_DIALECT || 'sqlite';
      const host =
        sequelize.config.host ||
        process.env.DB_HOST ||
        (dialect === 'sqlite' ? 'N/A' : 'localhost');
      const port =
        sequelize.config.port ||
        process.env.DB_PORT ||
        (dialect === 'mysql' ? '3306' : dialect === 'postgres' ? '5432' : 'N/A');
      console.error(`🔎 当前数据库配置: ${dialect}://${host}:${port}`);
      if (host === 'localhost' || host === '127.0.0.1') {
        console.error('💡 Docker bridge 网络建议使用数据库容器名；host 网络模式可使用 127.0.0.1');
      }
    }
    process.exit(1);
  }
}

start();
