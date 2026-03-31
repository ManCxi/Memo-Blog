const { Sequelize } = require('sequelize');
const fs = require('fs');
require('dotenv').config();

const rawDialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();
const dialect = rawDialect === 'postgresql' ? 'postgres' : rawDialect;
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const options = {
  dialect,
  logging: false,
  define: {
    timestamps: true,
  },
};

if (dialect === 'sqlite') {
  options.storage = process.env.DB_STORAGE || './database.sqlite';
} else {
  const runningInContainer = fs.existsSync('/.dockerenv');
  const configuredHost = process.env.DB_HOST || 'localhost';
  const isLinux = process.platform === 'linux';
  if (runningInContainer && (configuredHost === 'localhost' || configuredHost === '127.0.0.1')) {
    options.host = isLinux ? '127.0.0.1' : 'host.docker.internal';
  } else if (runningInContainer && isLinux && configuredHost === 'host.docker.internal') {
    options.host = '127.0.0.1';
  } else {
    options.host = configuredHost;
  }
  if (Number.isFinite(port)) {
    options.port = port;
  }
}

if (dialect === 'mysql') {
  options.define.charset = 'utf8mb4';
}

if (dialect === 'postgres' && process.env.DB_SSL === 'true') {
  options.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  };
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'blog',
  process.env.DB_USER || '',
  process.env.DB_PASSWORD || '',
  options
);

module.exports = sequelize;
