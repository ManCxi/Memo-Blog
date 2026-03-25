const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite';

const options = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT,
  dialect,
  logging: false,
  define: {
    charset: 'utf8mb4',
    timestamps: true
  }
};

if (dialect === 'sqlite') {
  options.storage = process.env.DB_STORAGE || './database.sqlite';
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'blog',
  process.env.DB_USER || '',
  process.env.DB_PASSWORD || '',
  options
);

module.exports = sequelize;
