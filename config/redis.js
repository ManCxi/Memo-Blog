require('dotenv').config();

const enabled = process.env.REDIS_ENABLED !== 'false';

if (!enabled) {
  console.log('ℹ️  Redis 已禁用（REDIS_ENABLED=false），Session 使用内存存储，缓存功能关闭');
  module.exports = { client: null, enabled: false };
} else {
  const Redis = require('ioredis');

  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3
  });

  client.on('connect', () => console.log('✅ Redis 连接成功'));
  client.on('error', (err) => console.error('Redis 连接错误:', err.message));

  module.exports = { client, enabled: true };
}
