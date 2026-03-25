// 需要登录才能访问的中间件
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.redirectTo = req.originalUrl;
  res.redirect('/admin/login');
}

// 需要管理员权限
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.session.error = '权限不足';
  res.redirect('/admin');
}

module.exports = { requireLogin, requireAdmin };
