const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Attachment } = require('../models');
const { UPLOADS_ROOT, resolveUploadDiskPath, getRelativeUploadPath } = require('../config/uploadsPath');

// MIME 类型 → 分类映射
function getFileType(mimetype, filename) {
  if (!mimetype || mimetype === 'application/octet-stream') {
    const ext = path.extname(filename).toLowerCase();
    const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.jfif'];
    const vidExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
    const audExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac'];
    const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'];
    if (imgExts.includes(ext)) return 'image';
    if (vidExts.includes(ext)) return 'video';
    if (audExts.includes(ext)) return 'audio';
    if (docExts.includes(ext)) return 'document';
    return 'other';
  }
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  const docMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats', 'text/plain', 'text/markdown'];
  if (docMimes.some(m => mimetype.startsWith(m))) return 'document';
  return 'other';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

    const rows = await Attachment.findAll({ order: [['createdAt', 'DESC']] });

    // 按类型过滤
    const filtered = type === 'all'
      ? rows
      : rows.filter(r => getFileType(r.mimetype, r.filename) === type);

    // 关键词过滤（在内存中，避免 SQLite LIKE 大小写问题）
    const searched = keyword
      ? filtered.filter(r => r.filename.toLowerCase().includes(keyword.toLowerCase()))
      : filtered;

    // 分页
    const total = searched.length;
    const offset = (page - 1) * limit;
    const items = searched.slice(offset, offset + limit).map(r => ({
      ...r.toJSON(),
      fileType: getFileType(r.mimetype, r.filename),
      sizeFormatted: formatSize(r.size || 0),
      isImage: getFileType(r.mimetype, r.filename) === 'image'
    }));

    const totalPages = Math.ceil(total / limit);

    res.render('admin/media/index', {
      title: '附件库',
      items, total, page, totalPages, limit,
      keyword, type, view
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
    const rows = await Attachment.findAll({ order: [['createdAt', 'DESC']] });
    const filtered = type === 'all' ? rows : rows.filter(r => getFileType(r.mimetype, r.filename) === type);
    const searched = keyword ? filtered.filter(r => r.filename.toLowerCase().includes(keyword.toLowerCase())) : filtered;
    const total = searched.length;
    const offset = (page - 1) * limit;
    const items = searched.slice(offset, offset + limit).map(r => ({
      id: r.id,
      filename: r.filename,
      path: r.path,
      size: r.size || 0,
      sizeFormatted: formatSize(r.size || 0),
      mimetype: r.mimetype,
      fileType: getFileType(r.mimetype, r.filename),
      createdAt: r.createdAt
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
        createdAt: data.createdAt
      }
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
    const urlPath = '/uploads/' + getRelativeUploadPath(filePath);

    const att = await Attachment.create({
      filename: displayName,
      path: urlPath,
      mimetype: mimetype || 'application/octet-stream',
      size: size || 0
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
        try { fs.unlinkSync(diskPath); } catch (e) { console.error('Failed to delete orphaned file:', e); }
      }
      return res.json({ ok: true, message: '文件已删除' });
    }

    // 删除磁盘文件
    const diskPath = resolveUploadDiskPath(att.path);
    if (diskPath && fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      if (!stat.isDirectory()) {
        try { fs.unlinkSync(diskPath); } catch (e) { console.error('Failed to delete file:', e); }
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
        try { fs.unlinkSync(diskPath); } catch (e) { console.error('Failed to delete file:', e); }
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
    const idList = [...new Set(rawIds.map(v => parseInt(v, 10)).filter(v => Number.isInteger(v) && v > 0))];
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
        } catch (e) { console.error('Failed to delete file:', e); }
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
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
          '.jfif': 'image/jpeg'
        };
        await Attachment.create({
          filename,
          path: urlPath,
          mimetype: mimeMap[ext] || 'application/octet-stream',
          size: stat.size,
          createdAt: stat.mtime
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

 
