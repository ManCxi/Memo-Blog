const path = require('path');
const fs = require('fs');

/** 上传文件物理目录：项目根目录下的 uploads/（不再使用 public/uploads） */
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
}

/**
 * 将 URL 路径转为磁盘绝对路径，如 /uploads/a.jpg
 * 防止路径穿越；非法时返回 null
 */
function resolveUploadDiskPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) {
    return null;
  }
  const rel = urlPath.slice('/uploads/'.length).replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return null;
  const base = path.resolve(UPLOADS_ROOT);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

/** 获取当前年/月目录名，如 "2024/05" */
function getDateDirectory() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return path.join(String(y), m);
}

/** 获取相对于 UPLOADS_ROOT 的路径（使用正斜杠） */
function getRelativeUploadPath(absolutePath) {
  const rel = path.relative(UPLOADS_ROOT, absolutePath);
  return rel.replace(/\\/g, '/');
}

module.exports = {
  UPLOADS_ROOT,
  ensureUploadsDir,
  resolveUploadDiskPath,
  getDateDirectory,
  getRelativeUploadPath,
};
