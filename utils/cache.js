const { client: redis, enabled: redisEnabled } = require('../config/redis');

const CACHE_EXPIRES = {
  HOME_ARTICLES: 300, // 首页文章列表 5分钟
  ARTICLE_DETAIL: 600, // 文章详情 10分钟
  CATEGORIES: 3600, // 分类列表 1小时
  TAGS: 3600, // 标签列表 1小时
  SIDEBAR: 600, // 侧边栏数据 10分钟
};

const cache = {
  async get(key) {
    if (!redisEnabled) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('缓存读取失败:', err.message);
      return null;
    }
  },

  async set(key, value, ttl = 300) {
    if (!redisEnabled) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      console.error('缓存写入失败:', err.message);
    }
  },

  async del(key) {
    if (!redisEnabled) return;
    try {
      await redis.del(key);
    } catch (err) {
      console.error('缓存删除失败:', err.message);
    }
  },

  async scanKeys(pattern) {
    if (!redisEnabled) return [];
    let cursor = '0';
    let keys = [];
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys = keys.concat(foundKeys);
      } while (cursor !== '0');
      return keys;
    } catch (err) {
      console.error('Redis SCAN 失败:', err.message);
      return [];
    }
  },

  async delPattern(pattern) {
    if (!redisEnabled) return;
    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.error('缓存批量删除失败:', err.message);
    }
  },

  // 文章阅读计数（Redis 高并发计数）
  async incrView(articleId) {
    if (!redisEnabled) return;
    try {
      await redis.incr(`article:view:${articleId}`);
    } catch (err) {
      console.error('阅读计数失败:', err.message);
    }
  },

  async getView(articleId) {
    if (!redisEnabled) return 0;
    try {
      const count = await redis.get(`article:view:${articleId}`);
      return count ? parseInt(count) : 0;
    } catch (err) {
      return 0;
    }
  },

  // 批量获取阅读量
  async getViewMap(articleIds) {
    if (!redisEnabled || !articleIds.length) return {};
    try {
      const keys = articleIds.map((id) => `article:view:${id}`);
      const counts = await redis.mget(...keys);
      const map = {};
      articleIds.forEach((id, i) => {
        map[id] = counts[i] ? parseInt(counts[i]) : 0;
      });
      return map;
    } catch (err) {
      console.error('批量获取阅读量失败:', err.message);
      return {};
    }
  },

  // 辅助函数：填充文章对象的实时阅读量
  async fillViews(articles) {
    if (!articles || (Array.isArray(articles) && articles.length === 0)) return articles;
    const isArray = Array.isArray(articles);
    const list = isArray ? articles : [articles];
    const ids = list.map((a) => a.id);
    const viewMap = await this.getViewMap(ids);
    list.forEach((a) => {
      const extra = viewMap[a.id] || 0;
      // 注意：这里修改的是内存中的对象，用于视图展示，不会自动同步到数据库
      // 这里的 views 是数据库/缓存中的值，extra 是 Redis 中的增量
      const currentViews = a.views || 0;
      const total = currentViews + extra;

      if (typeof a.setDataValue === 'function') {
        a.setDataValue('views', total);
      } else {
        a.views = total;
      }
      // 同时也保留 totalViews 属性，以防万一
      a.totalViews = total;
    });
    return articles;
  },

  // 将 Redis 中的阅读量同步到数据库
  async syncViews(Article) {
    if (!redisEnabled) return;
    try {
      const keys = await this.scanKeys('article:view:*');
      if (keys.length === 0) return;

      for (const key of keys) {
        if (key.endsWith(':syncing')) continue; // Skip temporary sync keys
        const id = parseInt(key.split(':')[2]);
        const tempKey = `${key}:syncing`;
        try {
          await redis.rename(key, tempKey);
        } catch (renameErr) {
          // key 不存在或已经被处理，跳过
          continue;
        }

        const count = parseInt(await redis.get(tempKey));
        if (count > 0) {
          await Article.increment('views', { by: count, where: { id } });
          await redis.del(tempKey);

          // 获取更新后的文章 slug 用于清除详情缓存
          const article = await Article.findByPk(id, { attributes: ['slug'] });
          if (article) {
            await this.del(`article:${article.slug}`);
          }
        } else {
          await redis.del(tempKey);
        }
      }
      // 同步后清除列表缓存和侧边栏，因为总阅读量/排行可能变了
      await this.delPattern('home:articles:*');
      await this.del('sidebar:data');
    } catch (err) {
      console.error('同步阅读量失败:', err.message);
    }
  },
};

module.exports = { cache, CACHE_EXPIRES };
