const bcrypt = require('bcryptjs');
const { User, Article, Category, Tag, Page } = require('../models');
const { getSettings, updateSettings, invalidateCache } = require('../utils/settings');
const { cache } = require('../utils/cache');

// 登录页
exports.loginPage = (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin/login', { title: '后台登录', layout: false });
};

// 登录处理
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('admin/login', {
        title: '后台登录',
        layout: false,
        error: '请输入用户名和密码',
      });
    }
    const user = await User.findOne({ where: { username } });
    if (!user || !(await user.validatePassword(password))) {
      return res.render('admin/login', {
        title: '后台登录',
        layout: false,
        error: '用户名或密码错误',
      });
    }
    req.session.user = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      avatar: user.avatar,
    };
    const redirectTo = req.session.redirectTo || '/admin';
    delete req.session.redirectTo;
    res.redirect(redirectTo);
  } catch (err) {
    console.error(err);
    res.render('admin/login', {
      title: '后台登录',
      layout: false,
      error: '服务器错误，请稍后重试',
    });
  }
};

// 退出登录
exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
};

// 仪表盘
exports.dashboard = async (req, res) => {
  try {
    const [articleCount, publishedCount, draftCount, categoryCount, tagCount, pageCount] =
      await Promise.all([
        Article.count(),
        Article.count({ where: { status: 'published' } }),
        Article.count({ where: { status: 'draft' } }),
        Category.count(),
        Tag.count(),
        Page.count(),
      ]);

    // 总 PV (数据库 + Redis 缓冲)
    let totalPv = (await Article.sum('views')) || 0;
    const { client: redis, enabled: redisEnabled } = require('../config/redis');
    if (redisEnabled && redis) {
      const keys = await cache.scanKeys('article:view:*');
      if (keys.length > 0) {
        const counts = await redis.mget(...keys);
        const redisTotal = counts.reduce((sum, c) => sum + (parseInt(c) || 0), 0);
        totalPv += redisTotal;
      }
    }

    const recentArticles = await Article.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{ association: 'category', attributes: ['name'] }],
    });
    // 填充实时阅读量
    await cache.fillViews(recentArticles);

    res.render('admin/dashboard', {
      title: '仪表盘',
      stats: {
        articleCount,
        publishedCount,
        draftCount,
        categoryCount,
        tagCount,
        pageCount,
        totalPv,
      },
      recentArticles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// 个人中心页
exports.profilePage = async (req, res) => {
  try {
    const user = await User.findByPk(req.session.user.id);
    const settings = await getSettings();
    const bloggerInfo = settings.blogger_info || {};
    res.render('admin/profile', { title: '个人中心', user, bloggerInfo });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// 更新个人资料
exports.updateProfile = async (req, res) => {
  try {
    const { nickname, email, avatar, bio, github, qq, website } = req.body;
    const user = await User.findByPk(req.session.user.id);
    await user.update({ nickname, email, avatar });

    // 更新 session
    req.session.user = { ...req.session.user, nickname, avatar };

    // 更新 blogger_info setting
    const settings = await getSettings();
    const bloggerInfo = {
      ...(settings.blogger_info || {}),
      nickname,
      email,
      avatar,
      bio,
      github,
      qq,
      website,
    };
    await updateSettings({ blogger_info: bloggerInfo });
    invalidateCache();

    req.session.success = '个人资料已保存';
    res.redirect('/admin/profile');
  } catch (err) {
    console.error(err);
    req.session.error = '保存失败：' + err.message;
    res.redirect('/admin/profile');
  }
};

// 修改密码
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      return res.json({ ok: false, message: '两次输入的新密码不一致' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.json({ ok: false, message: '新密码不能少于 6 位' });
    }
    const user = await User.findByPk(req.session.user.id);
    const ok = await user.validatePassword(currentPassword);
    if (!ok) {
      return res.json({ ok: false, message: '当前密码错误' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed }, { hooks: false });

    // 修改密码后退出登录
    req.session.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, message: '修改密码失败：' + err.message });
  }
};

// 全站统计 JSON 接口
exports.stats = async (req, res) => {
  try {
    const [articleCount, categoryCount, tagCount, pageCount] = await Promise.all([
      Article.count({ where: { status: 'published' } }),
      Category.count(),
      Tag.count(),
      Page.count(),
    ]);
    let totalPv = (await Article.sum('views')) || 0;
    const { client: redis, enabled: redisEnabled } = require('../config/redis');
    if (redisEnabled && redis) {
      const keys = await cache.scanKeys('article:view:*');
      if (keys.length > 0) {
        const counts = await redis.mget(...keys);
        const redisTotal = counts.reduce((sum, c) => sum + (parseInt(c) || 0), 0);
        totalPv += redisTotal;
      }
    }
    res.json({ articleCount, categoryCount, tagCount, pageCount, totalPv });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
