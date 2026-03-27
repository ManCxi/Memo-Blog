const { getSettings, updateSettings, invalidateCache } = require('../utils/settings');
const { Category, Article, Page } = require('../models');
const { sanitize } = require('../utils/sanitizer');

// 系统设置页
exports.settingsPage = async (req, res) => {
  try {
    const settings = await getSettings();
    res.render('admin/settings/index', { title: '系统设置', settings });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

exports.navPage = async (req, res) => {
  try {
    const settings = await getSettings();
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'slug'],
      order: [['sort', 'ASC']],
    });
    const pages = await Page.findAll({
      where: { status: 'published' },
      attributes: ['id', 'title', 'slug'],
    });
    res.render('admin/settings/nav', { title: '导航菜单', settings, categories, pages });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

exports.carouselPage = async (req, res) => {
  try {
    const settings = await getSettings();
    const articles = await Article.findAll({
      where: { status: 'published' },
      attributes: ['id', 'title', 'slug', 'cover', 'summary'],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.render('admin/settings/carousel', { title: '轮播图', settings, articles });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

exports.linksPage = async (req, res) => {
  try {
    const settings = await getSettings();
    res.render('admin/settings/links', { title: '友情链接', settings });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// 保存设置（POST，body 为 JSON 或 urlencoded）
exports.updateSettings = async (req, res) => {
  try {
    const data = req.body;
    // 某些字段可能是 JSON 字符串（来自前端 hidden input）
    const parsed = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue; // 跳过 _method 等辅助字段
      try {
        let val = value;
        if (key === 'head_code' || key === 'copyright' || key === 'site_description') {
          val = sanitize(value);
        }
        parsed[key] = JSON.parse(val);
      } catch {
        let val = value;
        if (key === 'head_code' || key === 'copyright' || key === 'site_description') {
          val = sanitize(value);
        }
        parsed[key] = val;
      }
    }
    await updateSettings(parsed);
    invalidateCache();
    res.redirect('/admin/settings?saved=1');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/settings?error=1');
  }
};

// JSON API：保存设置（前台 fetch 调用）
exports.updateSettingsApi = async (req, res) => {
  try {
    const data = req.body;
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'head_code' || key === 'copyright' || key === 'site_description') {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    await updateSettings(sanitized);
    invalidateCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
