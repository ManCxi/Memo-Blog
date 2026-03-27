const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const articleController = require('../controllers/articleController');
const feedController = require('../controllers/feedController');
const pageController = require('../controllers/pageController');

// ── 首页 ──────────────────────────────────────
router.get('/', homeController.index);

// ── 归档 ──────────────────────────────────────
router.get('/archive', homeController.archive);

// ── 搜索 ──────────────────────────────────────
router.get('/search', homeController.search);

// ── 友情链接 ───────────────────────────────────
router.get('/links', homeController.linksPage);

// ── RSS / Sitemap ─────────────────────────────
router.get('/rss.xml', feedController.rss);
router.get('/sitemap.xml', feedController.sitemap);

// ── 分类 / 标签 ────────────────────────────────
router.get('/category/:slug', articleController.category);
router.get('/tag/:slug', articleController.tag);

// ── 文章预览 ───────────────────────────────────
router.get('/article-preview', (req, res) => {
  res.render('preview');
});

// ── 文章详情 Demo（静态数据） ───────────────────
router.get('/article/demo', (req, res) => {
  const article = {
    title: '设计系统与组件架构实践指南',
    slug: 'demo',
    cover: '',
    pinned: true,
    createdAt: new Date('2025-03-01T12:00:00Z'),
    author: { nickname: '演示作者' },
    category: { name: '前端架构', slug: 'fe-arch' },
    tags: [
      { name: 'Design System', slug: 'design-system' },
      { name: 'CSS', slug: 'css' },
      { name: 'Accessibility', slug: 'a11y' },
    ],
  };
  const contentHtml = `
    <p>本文演示文章详情页的视觉与交互，包括目录生成、代码高亮、KaTeX 数学公式与 Mermaid 图表。</p>
    <h2>一、排版与层级</h2>
    <p>排版基于 <strong>.prose</strong> 风格，支持标题、列表、引用、表格等基础元素。</p>
    <h3>代码块演示</h3>
    <pre><code class="language-js">export function createButton(variant = 'primary') {
  const btn = document.createElement('button');
  btn.className = 'btn btn-' + variant;
  btn.textContent = '按钮';
  return btn;
}</code></pre>
    <h3>数学公式（KaTeX）</h3>
    <p>块级：$$E = mc^2$$ 行内：$\\int_a^b f(x)\\,dx$</p>
    <h3>流程图（Mermaid）</h3>
    <pre><code class="language-mermaid">flowchart TD
      A[Token] --> B[Component]
      B --> C[Pattern]
      C --> D[Page]</code></pre>
    <h2>二、交互要点</h2>
    <ul>
      <li>标题区域包含分类与标签徽章</li>
      <li>目录随滚动高亮当前标题</li>
      <li>上一篇/下一篇作为卡片链接展示</li>
    </ul>
    <blockquote>这是一段引用，用于展示文本对比与行高。</blockquote>
    <p>更多样式请在深浅色主题间切换查看。</p>
  `;
  const totalViews = 1024;
  const prevArticle = { title: '从零构建排版体系', slug: 'typography-system' };
  const nextArticle = { title: '响应式网格与布局', slug: 'responsive-grid' };
  res.render('article', {
    title: article.title,
    article,
    contentHtml,
    totalViews,
    prevArticle,
    nextArticle,
  });
});

// ── 文章详情 ───────────────────────────────────
router.get('/article/:slug', articleController.show);

// ── 独立页面 ───────────────────────────────────
router.get('/p/:slug', pageController.show);

module.exports = router;
