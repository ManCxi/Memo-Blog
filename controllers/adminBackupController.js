const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { sequelize, User, Category, Tag, Article, Page, Setting, Attachment } = require('../models');
const { UPLOADS_ROOT } = require('../config/uploadsPath');
const { cache } = require('../utils/cache');

// 渲染备份与恢复主页
exports.index = async (req, res, next) => {
  try {
    res.render('admin/backup/index', {
      title: '备份与恢复',
      activePage: 'backup',
      csrfToken: req.csrfToken(),
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};

// 导出备份（下载 ZIP 包）
exports.exportBackup = async (req, res, next) => {
  try {
    // 1. 获取所有表数据
    const users = await User.findAll({ raw: true });
    const categories = await Category.findAll({ raw: true });
    const tags = await Tag.findAll({ raw: true });
    const articles = await Article.findAll({ raw: true });
    const pages = await Page.findAll({ raw: true });
    const settings = await Setting.findAll({ raw: true });
    const attachments = await Attachment.findAll({ raw: true });

    // 查询关联表 ArticleTags
    const articleTags = await sequelize.query('SELECT * FROM ArticleTags', {
      type: sequelize.QueryTypes.SELECT,
    });

    const dbData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      User: users,
      Category: categories,
      Tag: tags,
      Article: articles,
      Page: pages,
      Setting: settings,
      Attachment: attachments,
      ArticleTags: articleTags,
    };

    const metadata = {
      app_version: '1.0.0',
      export_time: new Date().toISOString(),
      tables_summary: {
        users: users.length,
        categories: categories.length,
        tags: tags.length,
        articles: articles.length,
        pages: pages.length,
        settings: settings.length,
        attachments: attachments.length,
        articleTags: articleTags.length,
      },
    };

    // 2. 打包 ZIP
    const zip = new AdmZip();
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));
    zip.addFile('data.json', Buffer.from(JSON.stringify(dbData), 'utf8'));

    // 如果上传文件夹存在，将整个目录压入
    if (fs.existsSync(UPLOADS_ROOT)) {
      zip.addLocalFolder(UPLOADS_ROOT, 'uploads');
    }

    const zipBuffer = zip.toBuffer();
    const filename = `backup-memo-blog-${new Date().toISOString().slice(0, 10)}-${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
};

// 上传并恢复备份
exports.importBackup = async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ ok: false, message: '请选择要上传的备份 ZIP 文件。' });
  }

  try {
    const zip = new AdmZip(req.file.buffer);

    // 1. 读取并校验关键文件
    const dataEntry = zip.getEntry('data.json');

    if (!dataEntry) {
      return res
        .status(400)
        .json({ ok: false, message: '无效的备份包：缺少 data.json 数据文件。' });
    }

    const dbData = JSON.parse(dataEntry.getData().toString('utf8'));

    // 2. 数据库事务覆盖写入
    const t = await sequelize.transaction();
    try {
      const dialect = sequelize.getDialect();
      // 关闭外键约束
      if (dialect === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
      } else if (dialect === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = OFF', { transaction: t });
      } else if (dialect === 'postgres') {
        await sequelize.query('SET CONSTRAINTS ALL DEFERRED', { transaction: t });
      }

      // 清空原有表记录
      await sequelize.query('DELETE FROM ArticleTags', { transaction: t });
      await Attachment.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await Setting.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await Page.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await Article.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await Tag.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await Category.destroy({ where: {}, truncate: true, transaction: t, force: true });
      await User.destroy({ where: {}, truncate: true, transaction: t, force: true });

      // 按依赖顺序重构写入
      if (dbData.User && dbData.User.length) {
        await User.bulkCreate(dbData.User, { transaction: t });
      }
      if (dbData.Category && dbData.Category.length) {
        await Category.bulkCreate(dbData.Category, { transaction: t });
      }
      if (dbData.Tag && dbData.Tag.length) {
        await Tag.bulkCreate(dbData.Tag, { transaction: t });
      }
      if (dbData.Article && dbData.Article.length) {
        await Article.bulkCreate(dbData.Article, { transaction: t });
      }
      if (dbData.Page && dbData.Page.length) {
        await Page.bulkCreate(dbData.Page, { transaction: t });
      }
      if (dbData.Setting && dbData.Setting.length) {
        await Setting.bulkCreate(dbData.Setting, { transaction: t });
      }
      if (dbData.Attachment && dbData.Attachment.length) {
        await Attachment.bulkCreate(dbData.Attachment, { transaction: t });
      }

      // 重建文章标签关联
      if (dbData.ArticleTags && dbData.ArticleTags.length) {
        for (const row of dbData.ArticleTags) {
          await sequelize.query(
            'INSERT INTO ArticleTags (ArticleId, TagId, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
            {
              replacements: [row.ArticleId, row.TagId, row.createdAt, row.updatedAt],
              transaction: t,
            }
          );
        }
      }

      // 重启外键约束
      if (dialect === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
      } else if (dialect === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = ON', { transaction: t });
      }

      await t.commit();
    } catch (dbErr) {
      await t.rollback();
      throw dbErr;
    }

    // 3. 解压并覆盖写入 /uploads 文件
    const uploadsEntries = zip.getEntries().filter((e) => e.entryName.startsWith('uploads/'));
    for (const entry of uploadsEntries) {
      if (entry.isDirectory) continue;
      const relativePath = entry.entryName.substring('uploads/'.length);
      const fullPath = path.join(UPLOADS_ROOT, relativePath);
      const dirPath = path.dirname(fullPath);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(fullPath, entry.getData());
    }

    // 4. 清理 Redis 缓存
    await cache.delPattern('*');

    res.json({ ok: true, message: '系统数据与文件已成功恢复！' });
  } catch (err) {
    console.error('备份恢复失败:', err);
    res.status(500).json({ ok: false, message: '恢复失败，错误原因：' + err.message });
  }
};
