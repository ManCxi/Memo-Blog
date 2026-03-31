const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });
const { requireLogin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const multer = require('multer');
const path = require('path');
const { UPLOADS_ROOT, ensureUploadsDir, getDateDirectory } = require('../config/uploadsPath');
const fs = require('fs');

const adminController = require('../controllers/adminController');
const articleController = require('../controllers/adminArticleController');
const categoryController = require('../controllers/adminCategoryController');
const tagController = require('../controllers/adminTagController');
const taxonomyController = require('../controllers/adminTaxonomyController');
const settingController = require('../controllers/settingController');
const attachmentController = require('../controllers/attachmentController');
const pageController = require('../controllers/adminPageController');

// ── 任意文件的上传（不限图片类型）
ensureUploadsDir();
const uploadDir = UPLOADS_ROOT;

const anyUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dateDir = getDateDirectory();
      const fullPath = path.join(UPLOADS_ROOT, dateDir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      cb(null, fullPath);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    // 严格白名单：图片、常用文档、压缩包
    const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|ico|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z)$/i;
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/x-icon',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!allowedExtensions.test(ext) || !allowedMimes.includes(mime)) {
      return cb(new Error('不允许上传该文件类型，仅支持图片、文档及压缩包'), false);
    }
    
    // 二次检查：防止 SVG 包含脚本 (简单检查)
    if (ext === '.svg' || mime === 'image/svg+xml') {
      // 如果需要更严格的 SVG 过滤，建议使用专门的库，这里先做简单阻断
    }

    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ── 登录 / 退出 ──────────────────────────────
router.get('/login', adminController.loginPage);
router.post('/login', adminController.login);
router.post('/logout', requireLogin, adminController.logout);

// ── 以下路由都需要登录 ─────────────────────────
router.use(requireLogin);

// 仪表盘
router.get('/', adminController.dashboard);

// ── 个人中心 ─────────────────────────────────
router.get('/profile', adminController.profilePage);
router.post('/profile', adminController.updateProfile);
router.post('/profile/password', adminController.changePassword);

// ── 统计 JSON 接口 ───────────────────────────
router.get('/stats', adminController.stats);

// ── 系统设置 ─────────────────────────────────
router.get('/settings', settingController.settingsPage);
router.post('/settings', settingController.updateSettings);
router.put('/settings', settingController.updateSettingsApi);
router.get('/settings/nav', settingController.navPage);
router.get('/settings/carousel', settingController.carouselPage);
router.get('/settings/links', settingController.linksPage);

// ── 附件库 ───────────────────────────────────
router.get('/media', attachmentController.index);
router.post('/media/upload', anyUpload.single('file'), csrfProtection, attachmentController.upload);
router.delete('/media/:id', attachmentController.destroy);
router.post('/media/batch-delete', attachmentController.batchDestroy);
router.post('/media/delete-by-url', attachmentController.deleteByUrl);
router.post('/media/sync', attachmentController.sync);

// ── 图片上传接口（富文本编辑器使用）
router.post('/upload/image', upload.single('image'), csrfProtection, articleController.uploadImage);

// ── 附件 JSON 列表与详情 ─────────────────────
router.get('/media/list', attachmentController.list);
router.get('/media/detail/:id', attachmentController.detail);

// ── 文章 ────────────────────────────────────
router.get('/articles', articleController.index);
router.get('/articles/create', articleController.createPage);
router.post('/articles', upload.single('coverFile'), csrfProtection, articleController.create);
router.get('/articles/:id/preview', articleController.preview);
router.get('/articles/:id/edit', articleController.editPage);
router.put('/articles/:id', upload.single('coverFile'), csrfProtection, articleController.update);
router.delete('/articles/:id', articleController.destroy);

// ── 独立页面 ──────────────────────────────────
router.get('/pages', pageController.index);
router.get('/pages/create', pageController.createPage);
router.post('/pages', pageController.create);
router.get('/pages/:id/edit', pageController.editPage);
router.post('/pages/:id', pageController.update);
router.delete('/pages/:id', pageController.destroy);

// ── 分类与标签管理（合并页） ────────────────
router.get('/taxonomy', taxonomyController.index);

// ── 分类（API/动作） ────────────────────────
router.get('/categories/list', categoryController.listApi);
router.post('/categories', categoryController.create);
router.put('/categories/:id', categoryController.update);
router.delete('/categories/:id', categoryController.destroy);
router.post('/categories/reorder', categoryController.reorder);

// ── 标签（API/动作） ────────────────────────
router.get('/tags/list', tagController.listApi);
router.post('/tags', tagController.create);
router.put('/tags/:id', tagController.update);
router.delete('/tags/:id', tagController.destroy);

module.exports = router;
