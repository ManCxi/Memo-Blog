/**
 * 站点设置工具函数
 * 提供 getSetting(key)、getSettings()、updateSetting(key, value) 等便捷方法
 */
const { Setting } = require('../models');

// 内存缓存，避免每个请求都查数据库
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

/**
 * 获取所有设置，返回 { key: parsedValue } 对象
 */
async function getSettings() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }
  try {
    const rows = await Setting.findAll();
    const result = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    // 默认设置兜底
    if (!result.site_logo) result.site_logo = '/logo.png';
    if (!result.site_name) result.site_name = 'Memo';

    _cache = result;
    _cacheTime = now;
    return result;
  } catch {
    return _cache || {};
  }
}

/**
 * 获取单个设置值
 */
async function getSetting(key, defaultValue = null) {
  const settings = await getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * 更新单个设置
 */
async function updateSetting(key, value) {
  invalidateCache();
  await Setting.upsert({ key, value: JSON.stringify(value) });
}

/**
 * 批量更新设置（obj 为 { key: value }）
 */
async function updateSettings(obj) {
  invalidateCache();
  await Promise.all(
    Object.entries(obj).map(([key, value]) => Setting.upsert({ key, value: JSON.stringify(value) }))
  );
}

/** 使缓存失效 */
function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

module.exports = { getSettings, getSetting, updateSetting, updateSettings, invalidateCache };
