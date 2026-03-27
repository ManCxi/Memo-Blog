# CSS 模块化拆分方案

将 [main.css](file:///h:/blog/public/css/main.css)（2643行）拆分为按功能分层的独立 CSS 文件，提升可维护性和按需加载能力。

## 拆分目标结构

```
public/css/
├── main.css                    ← 改为 @import 聚合入口（基础 + 全局组件）
├── base/
│   ├── tokens.css              ← [NEW] :root CSS 变量（Design Tokens）
│   ├── reset.css               ← [NEW] Reset、body、a、img、滚动条、动画
│   └── dark-mode.css           ← [NEW] [data-theme='dark'] 全部覆盖样式
├── layout/
│   ├── navbar.css              ← [NEW] Navbar + Mobile Drawer
│   ├── footer.css              ← [NEW] 页脚
│   └── tab-bar.css             ← [NEW] 移动端 Tab Bar + 回顶部按钮
├── components/
│   ├── surface.css             ← [NEW] .surface-1/2/3 工具类
│   ├── badges.css              ← [NEW] .badge, .badge-category, .badge-tag 等
│   ├── sidebar.css             ← [NEW] 侧边栏卡片、Profile、Tag Cloud、倒计时
│   ├── form-controls.css       ← [NEW] .form-control
│   ├── nav-dropdown.css        ← [NEW] .nav-dropdown 导航下拉
│   ├── pagination.css          ← [NEW] .pagination, .page-btn
│   ├── breadcrumb.css          ← [NEW] .breadcrumb
│   ├── flash.css               ← [NEW] .flash, .flash-success, .flash-error
│   ├── empty-state.css         ← [NEW] .empty-state
│   ├── social-links.css        ← [NEW] .footer-social, .profile-social
│   ├── search-overlay.css      ← [NEW] 移动端搜索全屏遮罩
│   └── scroll-top.css          ← [NEW] .scroll-top-btn
├── pages/
│   ├── home.css                ← [MODIFY] 首页特有样式
│   ├── article.css             ← [MODIFY] 文章详情（prose、代码块、TOC、article-nav）
│   ├── archive.css             ← [MODIFY] 归档页（现代时间轴样式）
│   ├── category.css            ← [MODIFY] 分类/标签页
│   ├── links.css               ← 保持不变（已有相关样式）
│   ├── search.css              ← [NEW] 搜索结果页（page-hero.search-hero）
│   ├── 404.css                 ← [NEW] 404页
│   └── page.css                ← [NEW] 自定义独立页（prose 内容为主）
```

## 全局加载（所有页面，通过 main.css @import）

| 文件 | 内容摘要 |
|---|---|
| `base/tokens.css` | `:root { --accent, --surface-*, ... }` |
| `base/reset.css` | `*, html, body, a, img, scrollbar, @keyframes, .animate-*` |
| `base/dark-mode.css` | `[data-theme='dark'] { ... }` 所有覆盖 |
| `layout/navbar.css` | `.navbar, .navbar-*, .mobile-drawer*, .nav-link` |
| `layout/footer.css` | `.site-footer, .footer-*` |
| `layout/tab-bar.css` | `.tab-bar, .tab-item, .scroll-top-btn` |
| `components/surface.css` | `.surface-1/2/3` |
| `components/badges.css` | `.badge, .badge-category, .badge-tag, .badge-pinned` |
| `components/sidebar.css` | `.sidebar-card, .profile-*, .countdown-*, .tag-cloud-*, .cat-count, .latest-article-*` |
| `components/form-controls.css` | `.form-control` |
| `components/nav-dropdown.css` | `.nav-dropdown, .nav-dropdown-menu, .nav-dropdown-item` |
| `components/pagination.css` | `.pagination, .page-btn` |
| `components/breadcrumb.css` | `.breadcrumb, .breadcrumb-sep` |
| `components/flash.css` | `.flash, .flash-*` |
| `components/empty-state.css` | `.empty-state` |
| `components/social-links.css` | `.footer-social-*, .profile-social-*` |
| `components/search-overlay.css` | `.search-overlay, .search-hint*` |
| `components/scroll-top.css` | `.scroll-top-btn` |
| layout: container | `.container, .page-container, .article-layout, .section-*` |

## 页面专属加载（通过 head.ejs 按路由加载）

| 页面路由 | CSS 文件 | 新增样式 |
|---|---|---|
| `/` | [pages/home.css](file:///h:/blog/public/css/pages/home.css) | 首页卡片布局、article-grid 等 |
| `/article/*` | [pages/article.css](file:///h:/blog/public/css/pages/article.css) | prose、代码块、TOC、article-nav、article-detail |
| `/archive*` | [pages/archive.css](file:///h:/blog/public/css/pages/archive.css) | archive-year-group、archive-modern 等 |
| `/category*` `/tag*` | [pages/category.css](file:///h:/blog/public/css/pages/category.css) | article-row、page-hero、article-list |
| `/links*` | [pages/links.css](file:///h:/blog/public/css/pages/links.css) | (已有) |
| `/search*` | `pages/search.css` | search-hero、article-row、page-hero |
| `/404` | `pages/404.css` | .error-page、.error-* |
| `/page/*` | `pages/page.css` | prose 专属 |

## 需要覆写 head.ejs 的路由映射

当前只支持 `home/links/archive/category/article` 五个 pageKey，需要扩展：

```diff
 const pageKey = path === '/' ? 'home'
   : (path.startsWith('/links') ? 'links'
   : (path.startsWith('/archive') ? 'archive'
   : (path.startsWith('/category') ? 'category'
+  : (path.startsWith('/tag') ? 'category'
   : (path.startsWith('/article') ? 'article'
-  : ''))));
+  : (path.startsWith('/search') ? 'search'
+  : (path === '/404' || res.statusCode === 404 ? '404'
+  : (path.startsWith('/page') ? 'page'
+  : '')))))));
```

## 验证计划

### 手动验证（浏览器）
1. 启动开发服务：`npm run dev` 或 `node app.js`
2. 访问首页 `/`：检查卡片布局、导航栏、页脚样式是否正常
3. 访问文章详情页 `/article/xxx`：检查 prose 样式、代码块、TOC 是否正常
4. 访问归档页 `/archive`：检查时间轴样式
5. 访问分类页 `/category/xxx`：检查文章列表行样式
6. 切换暗色模式：验证 dark mode 是否生效
7. 缩小浏览器至移动端宽度：验证 Tab Bar 和 Mobile Drawer 是否正常
