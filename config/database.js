const { Sequelize } = require('sequelize');
require('dotenv').config();

const rawDialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();
const dialect = rawDialect === 'postgresql' ? 'postgres' : rawDialect;
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const options = {
  dialect,
  logging: false,
  define: {
    timestamps: true
  }
};

if (dialect === 'sqlite') {
  options.storage = process.env.DB_STORAGE || './database.sqlite';
} else {
  options.host = process.env.DB_HOST || 'localhost';
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
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
  };
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'blog',
  process.env.DB_USER || '',
  process.env.DB_PASSWORD || '',
  options
);

module.exports = sequelize;
