const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getRelativeUploadPath } = require('../config/uploadsPath');

/**
 * MIME 类型 → 分类映射
 */
function getFileType(mimetype, filename) {
  if (!mimetype || mimetype === 'application/octet-stream') {
    const ext = path.extname(filename).toLowerCase();
    const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.jfif'];
    const vidExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
    const audExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac'];
    const docExts = [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.md',
      '.html',
      '.htm',
    ];
    if (imgExts.includes(ext)) return 'image';
    if (vidExts.includes(ext)) return 'video';
    if (audExts.includes(ext)) return 'audio';
    if (docExts.includes(ext)) return 'document';
    return 'other';
  }
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  const docMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats',
    'text/plain',
    'text/markdown',
    'text/html',
  ];
  if (docMimes.some((m) => mimetype.startsWith(m))) return 'document';
  return 'other';
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 图像压缩与 WebP 转换逻辑
 */
async function compressImageIfPossible(filePath, mimetype) {
  const fallback = {
    filePath,
    size: fs.statSync(filePath).size,
    mimetype: mimetype || 'application/octet-stream',
  };
  if (!mimetype || !mimetype.startsWith('image/')) return fallback;
  try {
    const metadata = await sharp(filePath, { animated: true, failOn: 'none' }).metadata();
    if (!metadata || !metadata.format) return fallback;
    // 不处理动图 (GIF/Animated WebP)
    if (metadata.pages && metadata.pages > 1) return fallback;

    const format = String(metadata.format).toLowerCase();
    if (!['jpeg', 'jpg', 'png', 'webp'].includes(format)) return fallback;

    const originalSize = fallback.size;
    const sourceExt = path.extname(filePath).toLowerCase();
    const sourceName = path.basename(filePath, sourceExt);
    const sourceDir = path.dirname(filePath);
    const candidates = [];
    const width = Number(metadata.width) || 0;
    const height = Number(metadata.height) || 0;

    const buildBase = () => {
      let pipeline = sharp(filePath, { failOn: 'none' }).rotate();
      // 限制最大分辨率
      if (width > 2560 || height > 2560) {
        pipeline = pipeline.resize({
          width: 2560,
          height: 2560,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      return pipeline;
    };

    const addCandidate = async (pipeline, ext, outputMime) => {
      const tmpName = `${sourceName}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const tmpPath = path.join(sourceDir, tmpName);
      await pipeline.toFile(tmpPath);
      const stat = fs.statSync(tmpPath);
      candidates.push({ path: tmpPath, size: stat.size, mimetype: outputMime, ext });
    };

    // 尝试不同的压缩配置
    if (format === 'jpeg' || format === 'jpg') {
      await addCandidate(
        buildBase().jpeg({
          quality: 78,
          mozjpeg: true,
          progressive: true,
          chromaSubsampling: '4:2:0',
        }),
        'jpg',
        'image/jpeg'
      );
    }
    await addCandidate(
      buildBase().webp({ quality: metadata.hasAlpha ? 80 : 76, alphaQuality: 80, effort: 6 }),
      'webp',
      'image/webp'
    );

    if (!candidates.length) return fallback;

    // 找出最小的一个
    let best = candidates[0];
    for (const item of candidates) {
      if (item.size < best.size) best = item;
    }

    // 如果节省比例小于 5%，则保留原样
    const minSavingRatio = 0.05;
    if (best.size >= originalSize * (1 - minSavingRatio)) {
      candidates.forEach((it) => fs.existsSync(it.path) && fs.unlinkSync(it.path));
      return fallback;
    }

    // 成功压缩，替换或重命名
    const bestExt = `.${best.ext}`;
    const targetPath =
      sourceExt === bestExt ? filePath : path.join(sourceDir, `${sourceName}${bestExt}`);

    candidates.forEach((it) => {
      if (it.path !== best.path && fs.existsSync(it.path)) fs.unlinkSync(it.path);
    });

    if (best.path !== targetPath) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      fs.renameSync(best.path, targetPath);
    }

    // 如果文件名（后缀）变了，删除旧文件
    if (targetPath !== filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { filePath: targetPath, size: best.size, mimetype: best.mimetype };
  } catch (err) {
    console.error('Image compression failed:', err);
    return fallback;
  }
}

module.exports = {
  getFileType,
  formatSize,
  compressImageIfPossible,
};
