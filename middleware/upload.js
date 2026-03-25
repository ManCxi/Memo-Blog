const multer = require('multer');
const path = require('path');
const { UPLOADS_ROOT, ensureUploadsDir, getDateDirectory } = require('../config/uploadsPath');
const fs = require('fs');

ensureUploadsDir();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dateDir = getDateDirectory();
    const fullPath = path.join(UPLOADS_ROOT, dateDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    cb(null, fullPath);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件（jpg/png/gif/webp）'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;
