# Docker 部署指南

本项目支持使用 Docker 进行容器化部署。通过 Docker，你可以快速在任何支持容器的环境中运行博客系统。

## 1. 编译镜像

在项目根目录下执行以下命令来编译 Docker 镜像。你可以为镜像指定一个标签（tag），例如 `memo-blog:v1.0`。

```bash
docker build -t memo-blog:latest .
```

### 编译说明
- 项目使用 **多阶段构建 (Multi-stage Build)**，有效减小最终镜像体积（仅保留运行时必要的依赖）。
- 基础镜像采用 `node:24-alpine`，运行环境极简且安全。
- 编译过程中会自动安装 `python3`, `make`, `g++` 以支持原生模块（如 `sqlite3`, `sharp`）的编译，但在最终运行镜像中这些工具会被移除。

## 2. 运行容器

### 基础运行
使用以下命令启动容器。建议将主机的 `./uploads` 目录挂载到容器中，以确保上传的图片在容器重启后不会丢失。

```bash
docker run -d \
  --name my-blog \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -e SESSION_SECRET=your-random-secret-key \
  -e JWT_SECRET=another-random-secret-key \
  memo-blog:latest
```

### 环境变量传递
你可以通过 `-e` 或 `--env-file` 传递环境变量。

常用变量：
- `NODE_ENV=production`
- `DB_DIALECT=sqlite` (或 mysql/postgres)
- `REDIS_ENABLED=false` (不连接外部 Redis 时建议设为 false)

### 持久化数据库 (SQLite 模式)
如果你使用 SQLite 数据库，也需要挂载数据库文件：

```bash
docker run -d \
  --name my-blog \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/database.sqlite:/app/database.sqlite \
  memo-blog:latest
```

## 3. 使用 Docker Compose (推荐)

创建 `docker-compose.yml` 可以更方便地管理应用及其依赖项（如 MySQL/Redis）。

```yaml
version: '3.8'
services:
  blog:
    build: .
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
      - ./database.sqlite:/app/database.sqlite
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=my_custom_secret
      - REDIS_ENABLED=false
```

然后运行：
```bash
docker-compose up -d
```

## 4. 镜像优化建议
- 最终运行用户为 `node` 非 root，符合安全规范。
- 端口 3000 已在 Dockerfile 中通过 `EXPOSE` 声明。
- 默认启动命令为 `npm run start`。
