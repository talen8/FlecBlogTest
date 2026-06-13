# Docker 部署迁移至原生部署指南

## 概述

FlecBlog 支持从 Docker Compose 部署迁移至原生 PM2 部署方式。原生部署具有更低的资源占用和更直接的系统集成。

---

## 迁移方式

### 推荐：使用安装脚本自动迁移

一键安装脚本提供了交互式的 Docker 迁移模式，会自动处理数据备份、服务停止、数据迁移等步骤：

```bash
curl -fsSL https://install.talen.cyou | bash
```

启动后选择 **"从 Docker Compose 迁移"** 选项，按提示操作即可。

脚本会自动完成：
- ✅ 备份 Docker 数据（.env、上传文件、数据库）
- ✅ 停止 Docker 服务并释放端口
- ✅ 下载并安装 FlecBlog 最新版本
- ✅ 迁移配置文件和上传文件
- ✅ 修正数据库连接配置（DB_HOST）
- ✅ 引导 PostgreSQL 部署选择
- ✅ 启动 PM2 服务

---

## 手动迁移步骤

如果需要手动控制迁移过程，可参考以下步骤：

### 1. 备份数据

```bash
# 创建备份目录
mkdir -p /tmp/flecblog-backup

# 备份配置文件（与 docker-compose.yml 同目录）
cp <docker-compose目录>/.env /tmp/flecblog-backup/.env

# 备份上传文件（默认在 /srv/flecblog）
cp -r /srv/flecblog /tmp/flecblog-backup/

# 备份数据库
docker exec flec_postgres pg_dump -U postgres -d postgres > /tmp/flecblog-backup/flecblog.sql
```

### 2. 停止 Docker 服务

```bash
cd <docker-compose目录> && docker compose down
```

### 3. 准备 PostgreSQL

**方式 A：宿主机原生安装（推荐）**
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -d postgres < /tmp/flecblog-backup/flecblog.sql
```

**方式 B：Docker 单独运行**
```bash
docker run -d \
  --name flec_postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<你的数据库密码> \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

docker exec -i flec_postgres psql -U postgres -d postgres < /tmp/flecblog-backup/flecblog.sql
```

### 4. 运行安装脚本

```bash
curl -fsSL https://install.talen.cyou | bash
```

选择 **"全新安装"** 模式，填入数据库连接信息时使用备份的凭据。

### 5. 迁移数据文件

```bash
# 复制上传文件
cp -r /tmp/flecblog-backup/srv/flecblog/uploads/* /opt/flecblog/uploads/

# 重启服务
pm2 restart all
```

---

## 验证迁移结果

```bash
# 检查服务状态
pm2 status

# 测试 API
curl http://localhost:8080/api/v1/setup/status

# 测试 Blog
curl -I http://localhost:3000
```

---

## 清理旧资源

确认服务正常后，可清理 Docker 资源：

```bash
# 删除旧容器
docker rm flec_server flec_blog flec_admin flec_postgres 2>/dev/null || true

# 删除网络
docker network rm flec-network 2>/dev/null || true

# ⚠️ 仅在确认新服务完全正常后删除数据卷
docker volume rm postgres_data 2>/dev/null || true
```

---

## 常见问题

**Q: 迁移后无法访问？**  
A: 检查防火墙是否开放端口，确认 `pm2 logs` 无错误。

**Q: 数据库连接失败？**  
A: 检查 `/opt/flecblog/.env` 中的 `DB_HOST` 是否改为 `localhost`（原 Docker 为 `postgres`）。

**Q: 上传文件丢失？**  
A: 确认已从 `/srv/flecblog/uploads` 复制到 `/opt/flecblog/uploads`。

---

## 参考资料

- [安装脚本源码](https://github.com/talen8/FlecBlog/blob/main/install.js)
- [部署文档](https://github.com/talen8/FlecBlog/tree/main/docs)

