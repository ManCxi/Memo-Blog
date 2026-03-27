# Memo Blog

一个基于 `Node.js + Express + EJS + Sequelize + Redis` 的博客系统，包含前台博客展示与后台管理，支持文章管理、页面管理、附件库、友情链接、轮播图、导航配置、RSS、站点地图等功能。

## 功能特性

- **前后台一体化**：前台博客展示，后台内容管理
- **现代响应式设计**：受 iOS 启发，适配 PC、平板与手机端，包含移动端底部导航栏
- **多数据库支持**：`SQLite / MySQL / PostgreSQL`
- **安全加固**：
  - **CSRF 防护**：防止跨站请求伪造
  - **XSS 过滤**：对文章与页面内容进行双重清洗
  - **安全头注入**：使用 `Helmet` 强化浏览器安全头
  - **频率限制**：对登录等敏感接口进行 Rate Limiting
- **Redis 可选**：支持 Session 存储、缓存、阅读量增量同步
- **文章管理**：草稿、发布、置顶、分类、标签、封面、实时同步预览
- **独立页面管理**
- **附件库**：支持本地上传、图片压缩、多选删除、同步本地目录
- **站点设置**：站点信息、导航菜单配置、轮播图管理、友情链接
- **前台能力**：归档、搜索、分类页、标签页、友情链接页
- **Feed 能力**：`/rss.xml`、`/sitemap.xml`
- **内容展示增强**：代码高亮、KaTeX 数学公式、Mermaid 图表
- **深浅色主题**：手动切换设计，随系统自动适应

## 技术栈

- **服务端**：`Node.js`, `Express`
- **模板引擎**：`EJS`
- **ORM**：`Sequelize`
- **安全增强**：`bcryptjs`, `jsonwebtoken`, `helmet`, `csurf`, `express-rate-limit`, `sanitize-html`
- **数据库驱动**：`sqlite3`, `mysql2`, `pg`
- **会话/缓存**：`express-session`, `connect-redis`, `ioredis`
- **上传处理**：`multer`, `sharp` (图片压缩)
- **工具库**：`marked`, `zod`, `slugify`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，按需修改。

示例：

```env
PORT=3000
SESSION_SECRET=your-session-secret-at-least-16-chars
JWT_SECRET=your-jwt-secret-at-least-16-chars

DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

SITE_TITLE=Memo
SITE_DESCRIPTION=分享技术与生活
```

### 3. 初始化项目

```bash
npm run init
```

初始化脚本会：创建数据库表、创建默认管理员账号（`admin`/`admin123456`）、初始化站点设置、示例数据等。

### 4. 启动项目

开发模式：`npm run dev` | 生产模式：`npm start`

## 环境变量说明

- `PORT`：服务端口
- `SESSION_SECRET`：Session 签名密钥
- `JWT_SECRET`：API JWT 签名密钥
- `DB_DIALECT`：`sqlite` / `mysql` / `postgres`
- `REDIS_ENABLED`：设为 `false` 可完全禁用 Redis

## 数据库与 Redis

项目默认支持 **SQLite** 以便快速上手。在生产环境下推荐使用 **MySQL** 和 **Redis**。
当 `REDIS_ENABLED=true` 时，系统将开启缓存层与阅读量延迟落库机制，大幅提升访问性能。

## 项目结构

```text
.
├─ app.js           # 入口
├─ config/          # 数据库、Redis、上传路径配置
├─ controllers/     # 业务逻辑
├─ middleware/      # 鉴权、安全、上传中间件
├─ models/          # 数据库模型
├─ public/          # 静态资源 (CSS, JS, Fonts, Libs)
├─ routes/          # 路由定义
├─ services/        # 核心服务 (Media, Sidebar)
├─ utils/           # 工具函数 (Sanitizer, Cache, Settings)
├─ views/           # EJS 模板
└─ uploads/         # 上传存放目录
```

## 生产运行

可以使用 `pm2`：

```bash
pm2 start app.js --name memo-blog
```

## 默认行为说明

- 启动时会执行数据库连接与同步
- 优先尝试 `sequelize.sync({ alter: { drop: false } })`
- 若增量同步失败，会回退为基础同步
- 开启 Redis 时，阅读量会定时落库

## 适用场景

- 个人博客
- 内网知识库
- 单机内容管理系统
- 不希望引入前后端分离复杂度的内容站点

## License

本项目采用 [知识共享 署名-非商业性使用-相同方式共享 4.0 国际版 (CC BY-NC-SA 4.0)][cc-by-nc-sa] 协议授权。
[![CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
