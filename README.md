# Memo Blog

一个基于 `Node.js + Express + EJS + Sequelize + Redis` 的博客系统，包含前台博客展示与后台管理，支持文章管理、页面管理、附件库、友情链接、轮播图、导航配置、RSS、站点地图等功能。

## 功能特性

- 前后台一体化：前台博客展示，后台内容管理
- 多数据库支持：`SQLite / MySQL / PostgreSQL`
- Redis 可选：支持 Session 存储、缓存、阅读量增量同步
- 文章管理：草稿、发布、置顶、分类、标签、封面、预览
- 独立页面管理
- 附件库与本地上传目录同步
- 站点设置：站点信息、导航菜单、轮播图、友情链接
- 前台能力：归档、搜索、分类页、标签页、友情链接页
- Feed 能力：`/rss.xml`、`/sitemap.xml`
- 内容展示增强：
  - 代码高亮
  - KaTeX 数学公式
  - Mermaid 图表
  - DOMPurify 内容净化
- 深浅色主题切换

## 技术栈

- 服务端：`Node.js`、`Express`
- 模板引擎：`EJS`
- ORM：`Sequelize`
- 数据库驱动：`sqlite3`、`mysql2`、`pg`
- 会话：`express-session`、`connect-redis`
- Redis 客户端：`ioredis`
- 上传：`multer`
- 日志：`morgan`
- 方法覆写：`method-override`

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
SESSION_SECRET=your-secret-key-change-this

DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

SITE_TITLE=Memo
SITE_DESCRIPTION=分享技术与生活
SITE_KEYWORDS=博客,技术,生活
```

### 3. 初始化项目

```bash
npm run init
```

初始化脚本会：

- 创建数据库表
- 创建默认管理员账号
- 初始化站点设置
- 初始化示例分类、标签、文章
- 自动补充默认轮播图数据

默认管理员账号：

- 用户名：`admin`
- 密码：`admin123456`

首次登录后请立即修改密码。

### 4. 启动项目

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

启动后访问：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin`

## 环境变量说明

### 应用

- `PORT`：服务端口
- `SESSION_SECRET`：Session 密钥

### 数据库

- `DB_DIALECT`：`sqlite` / `mysql` / `postgres`
- `DB_STORAGE`：SQLite 文件路径
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### Redis

- `REDIS_ENABLED`：设为 `false` 时禁用 Redis
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

### 默认站点信息

- `SITE_TITLE`
- `SITE_DESCRIPTION`
- `SITE_KEYWORDS`

## 数据库说明

项目通过 Sequelize 统一适配数据库。

### SQLite

适合本地开发、单机部署、快速试用：

```env
DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite
```

### MySQL

适合常规生产环境：

```env
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=blog
DB_USER=root
DB_PASSWORD=123456
```

### PostgreSQL

同样支持：

```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blog
DB_USER=postgres
DB_PASSWORD=123456
```

## Redis 说明

Redis 不是强制依赖。

当 `REDIS_ENABLED=true` 时：

- Session 使用 Redis Store
- 缓存能力开启
- 阅读量会按间隔同步回数据库

当 `REDIS_ENABLED=false` 时：

- Session 回退到内存存储
- 缓存逻辑跳过
- 项目仍可运行

禁用示例：

```env
REDIS_ENABLED=false
```

## 主要路由

### 前台

- `/`：首页
- `/archive`：归档
- `/search`：搜索
- `/links`：友情链接
- `/category/:slug`：分类页
- `/tag/:slug`：标签页
- `/article/:slug`：文章详情
- `/p/:slug`：独立页面
- `/article-preview`：文章预览页
- `/rss.xml`：RSS
- `/sitemap.xml`：站点地图

### 后台

- `/admin`：仪表盘
- `/admin/articles`：文章管理
- `/admin/pages`：页面管理
- `/admin/taxonomy`：分类/标签管理
- `/admin/media`：附件库
- `/admin/settings`：站点设置
- `/admin/profile`：个人资料

## 上传与静态文件

- 上传目录：`uploads/`
- 静态资源目录：`public/`
- 上传文件通过 `/uploads` 暴露
- 项目启动时会自动确保上传目录存在

## 项目结构

```text
.
├─ app.js
├─ init.js
├─ package.json
├─ config/
│  ├─ database.js
│  ├─ redis.js
│  └─ uploadsPath.js
├─ controllers/
├─ middleware/
├─ models/
├─ routes/
├─ utils/
├─ views/
├─ public/
│  ├─ css/
│  ├─ fonts/
│  └─ libs/
└─ uploads/
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
