const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// 简单身份验证中间件 (针对 API)
const requireApiLogin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 假设这是有效的 (为了复刻，简单处理，真实应用需验证 JWT，或者共享 session)
    return next();
  }
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// ── Articles ──
router.get('/articles', apiController.getArticles);
router.get('/articles/:id', apiController.getArticleById);
router.post('/articles', requireApiLogin, apiController.createArticle);
router.put('/articles/:id', requireApiLogin, apiController.updateArticle);
router.delete('/articles/:id', requireApiLogin, apiController.deleteArticle);

// ── Categories ──
router.get('/categories', apiController.getCategories);
router.post('/categories', requireApiLogin, apiController.createCategory);
router.put('/categories/:id', requireApiLogin, apiController.updateCategory);
router.delete('/categories/:id', requireApiLogin, apiController.deleteCategory);

// ── Tags ──
router.get('/tags', apiController.getTags);
router.post('/tags', requireApiLogin, apiController.createTag);
router.put('/tags/:id', requireApiLogin, apiController.updateTag);
router.delete('/tags/:id', requireApiLogin, apiController.deleteTag);

// ── Settings ──
router.get('/settings', apiController.getSettings);
router.post('/settings', requireApiLogin, apiController.updateSettings);

// ── Auth & Stats ──
router.post('/auth/login', apiController.login);
router.get('/auth/profile', requireApiLogin, apiController.getProfile);
router.post('/auth/password', requireApiLogin, apiController.updatePassword);
router.get('/auth/stats', apiController.getStats); // web 侧需要

module.exports = router;
