const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Attachment } = require('../models');
const {
  UPLOADS_ROOT,
  resolveUploadDiskPath,
  getRelativeUploadPath,
} = require('../config/uploadsPath');
const { getFileType, formatSize, compressImageIfPossible } = require('../services/mediaService');

// Helpers moved to services/mediaService.js

// 附件列表页（HTML 渲染）
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const keyword = req.query.keyword || '';
    const type = req.query.type || 'all';
    const view = req.query.view || 'grid';

    const where = {};
    if (keyword) {
      where.filename = { [Op.like]: `%${keyword}%` };
    }

    // 按类型映射到 DB 查询
    if (type !== 'all') {
      if (type === 'image') where.mimetype = { [Op.like]: 'image/%' };
      else if (type === 'video') where.mimetype = { [Op.like]: 'video/%' };
      else if (type === 'audio') where.mimetype = { [Op.like]: 'audio/%' };
      else if (type === 'document') {
        where.mimetype = {
          [Op.or]: [
            { [Op.like]: 'application/pdf%' },
            { [Op.like]: 'text/%' },
            { [Op.like]: 'application/msword%' },
            { [Op.like]: 'application/vnd.openxmlformats%' },
          ],
        };
      }
    }

    const { count: total, rows } = await Attachment.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const items = rows.map((r) => ({
      ...r.toJSON(),
      fileType: getFileType(r.mimetype, r.filename),
      sizeFormatted: formatSize(r.size || 0),
      isImage: getFileType(r.mimetype, r.filename) === 'image',
    }));

    const totalPages = Math.ceil(total / limit);

    res.render('admin/media/index', {
      title: '附件库',
      items,
      total,
      page,
      totalPages,
      limit,
      keyword,
      type,
      view,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
};

// JSON 列表
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const keyword = req.query.keyword || '';
    const type = req.query.type || 'all';

    const where = {};
    if (keyword) where.filename = { [Op.like]: `%${keyword}%` };
    if (type !== 'all') {
      if (type === 'image') where.mimetype = { [Op.like]: 'image/%' };
      else if (type === 'video') where.mimetype = { [Op.like]: 'video/%' };
      else if (type === 'audio') where.mimetype = { [Op.like]: 'audio/%' };
      else if (type === 'document') {
        where.mimetype = {
          [Op.or]: [
            { [Op.like]: 'application/pdf%' },
            { [Op.like]: 'text/%' },
            { [Op.like]: 'application/msword%' },
            { [Op.like]: 'application/vnd.openxmlformats%' },
          ],
        };
      }
    }

    const { count: total, rows } = await Attachment.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const items = rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      path: r.path,
      size: r.size || 0,
      sizeFormatted: formatSize(r.size || 0),
      mimetype: r.mimetype,
      fileType: getFileType(r.mimetype, r.filename),
      createdAt: r.createdAt,
    }));
    res.json({ ok: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// 获取详情
exports.detail = async (req, res) => {
  try {
    const att = await Attachment.findByPk(req.params.id);
    if (!att) return res.status(404).json({ ok: false });
    const data = att.toJSON();
    res.json({
      ok: true,
      item: {
        id: data.id,
        filename: data.filename,
        path: data.path,
        mimetype: data.mimetype,
        fileType: getFileType(data.mimetype, data.filename),
        size: data.size || 0,
        sizeFormatted: formatSize(data.size || 0),
        createdAt: data.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// 上传附件（JSON 返回，供前端 Ajax 调用）
exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: '未接收到文件' });
    }
    const { filename, path: filePath, mimetype, size, originalname } = req.file;
    const displayName = Buffer.from(originalname || filename, 'latin1').toString('utf8');
    const compressed = await compressImageIfPossible(filePath, mimetype);
    const finalPath = compressed.filePath || filePath;
    const urlPath = '/uploads/' + getRelativeUploadPath(finalPath);

    const att = await Attachment.create({
      filename: displayName,
      path: urlPath,
      mimetype: compressed.mimetype,
      size: compressed.size || size || 0,
    });

    res.json({ ok: true, url: urlPath, id: att.id, filename: displayName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// 根据 URL 删除附件（供编辑器等场景使用）
exports.deleteByUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, message: '未提供 url' });
    }

    // 只处理本站上传的文件 (以 /uploads/ 开头)
    if (!url.startsWith('/uploads/')) {
      return res.json({ ok: true, message: '非本站上传文件，忽略' });
    }

    const att = await Attachment.findOne({ where: { path: url } });
    if (!att) {
      // 数据库没有，但可能磁盘有
      const diskPath = resolveUploadDiskPath(url);
      if (diskPath && fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (e) {
          console.error('Failed to delete orphaned file:', e);
        }
      }
      return res.json({ ok: true, message: '文件已删除' });
    }

    // 删除磁盘文件
    const diskPath = resolveUploadDiskPath(att.path);
    if (diskPath && fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      if (!stat.isDirectory()) {
        try {
          fs.unlinkSync(diskPath);
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
    }
    await att.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
exports.destroy = async (req, res) => {
  try {
    const att = await Attachment.findByPk(req.params.id);
    if (!att) return res.status(404).json({ ok: false, message: '附件不存在' });

    // 删除磁盘文件
    const diskPath = resolveUploadDiskPath(att.path);
    if (diskPath && fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      if (!stat.isDirectory()) {
        try {
          fs.unlinkSync(diskPath);
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
    }
    await att.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// 批量删除附件
exports.batchDestroy = async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!ids || !ids.length) {
      return res.status(400).json({ ok: false, message: '未提供 ids' });
    }
    const rawIds = Array.isArray(ids) ? ids : String(ids).split(',');
    const idList = [
      ...new Set(rawIds.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0)),
    ];
    if (!idList.length) {
      return res.status(400).json({ ok: false, message: '未提供有效 ids' });
    }
    const atts = await Attachment.findAll({ where: { id: { [Op.in]: idList } } });

    for (const att of atts) {
      const diskPath = resolveUploadDiskPath(att.path);
      if (diskPath && fs.existsSync(diskPath)) {
        try {
          const stat = fs.statSync(diskPath);
          if (!stat.isDirectory()) {
            fs.unlinkSync(diskPath);
          }
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
      await att.destroy();
    }
    res.json({ ok: true, deleted: atts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

// 递归获取目录下所有文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file.startsWith('.')) continue;
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

// 同步本地 uploads 目录到数据库
exports.sync = async (req, res) => {
  try {
    const uploadsDir = UPLOADS_ROOT;
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ ok: true, synced: 0 });
    }

    const allFiles = getAllFiles(uploadsDir);
    let synced = 0;

    for (const fullPath of allFiles) {
      const relativePath = path.relative(uploadsDir, fullPath).replace(/\\/g, '/');
      const urlPath = '/uploads/' + relativePath;

      const existing = await Attachment.findOne({ where: { path: urlPath } });
      if (!existing) {
        const stat = fs.statSync(fullPath);
        const filename = path.basename(fullPath);
        const ext = path.extname(filename).toLowerCase();
        const mimeMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
          '.mp4': 'video/mp4',
          '.mp3': 'audio/mpeg',
          '.jfif': 'image/jpeg',
        };
        await Attachment.create({
          filename,
          path: urlPath,
          mimetype: mimeMap[ext] || 'application/octet-stream',
          size: stat.size,
          createdAt: stat.mtime,
        });
        synced++;
      }
    }
    res.json({ ok: true, synced });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, message: err.message });
  }
};
