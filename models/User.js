const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), unique: 'unique_user_username', allowNull: false },
  password: { type: DataTypes.STRING(100), allowNull: false },
  nickname: { type: DataTypes.STRING(50), defaultValue: '管理员' },
  email: { type: DataTypes.STRING(100) },
  avatar: { type: DataTypes.STRING(200) },
  role: { type: DataTypes.ENUM('admin', 'editor'), defaultValue: 'admin' }
}, {
  tableName: 'Users',
  freezeTableName: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;
