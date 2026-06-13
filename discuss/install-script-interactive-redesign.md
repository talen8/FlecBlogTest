# 安装脚本交互式重设计方案

## 背景

当前架构存在冗余：
- 安装脚本下载二进制 + 构建 Blog，但不配置数据库
- 用户需访问 `/setup/` 网页完成数据库配置
- 迁移场景需手动操作多个步骤

**重设计目标**：将所有配置逻辑前移到安装脚本的交互式流程中，彻底移除 setup 网页。

---

## 技术可行性确认

### 1. 数据库自动初始化 ✅

**现状**：`server/cmd/main.go:64-69`
```go
if err := database.RunMigrations(db.DB); err != nil {
    log.Fatalf("Failed to run migrations: %v", err)
}
```

**结论**：Server 在正常模式启动时，只要 `.env` 包含有效 DB 凭据，就会自动执行 `init_database.sql` 和 `seed_system_settings.sql`。

### 2. JWT 密钥生成 ✅

**方案**：
```bash
JWT_SECRET=$(openssl rand -base64 32)
```

**结论**：所有主流 Linux 发行版预装 OpenSSL，完全可靠。

### 3. Docker Compose 解析 ⚠️

**纯 bash 方案**（示例）：
```bash
DB_PASSWORD=$(grep "DB_PASSWORD:" docker-compose.yml | sed 's/.*\${*\([^}]*\).*/\1/')
```

**风险**：用户自定义格式、注释、多行值可能导致解析失败。

**推荐方案**：
- Docker 迁移模式改为**交互式询问**数据卷路径（默认 `/srv/flecblog`）
- 不自动解析 YAML，由用户确认路径（更透明、更可靠）

---

## 四种部署模式设计

### 模式 1：全新安装

**交互流程**：
1. 提示："检测到全新安装，将配置数据库和服务端口"
2. 循环询问数据库连接信息（Host/Port/Name/User/Password）
   - 每次输入后立即用 `psql` 测试连接
   - 连接失败显示错误信息并重新询问
3. 询问 JWT 密钥（回车跳过则自动生成）
4. 循环询问 Server 端口和 Blog 端口（检测占用）
5. 显示配置摘要，确认后写入 `.env` 和 `ecosystem.config.js`
6. 启动服务，首次启动自动建表

**关键命令**：
```bash
# 测试数据库连接
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null

# 生成 JWT
JWT_SECRET=$(openssl rand -base64 32)
```

---

### 模式 2：Docker 迁移

**交互流程**：
1. 提示："检测到 Docker 迁移模式，将自动迁移数据和配置"
2. 询问 `docker-compose.yml` 所在目录路径
   - 验证文件存在性
3. 从同目录读取 `.env` 文件
   - 解析出 `DB_PASSWORD` 和 `JWT_SECRET`
4. 询问 Docker 数据卷路径（默认 `/srv/flecblog`，可修改）
   - 验证目录存在性
5. 询问 PostgreSQL 容器名（默认 `flec_postgres`）
6. 显示迁移计划：
   - 备份路径：`/tmp/flecblog-backup`
   - 源 .env：`<compose目录>/.env`
   - 源数据卷：`<数据卷路径>`
   - 数据库容器：`<容器名>`
7. 确认后执行：
   ```bash
   # 备份
   mkdir -p /tmp/flecblog-backup
   cp <compose目录>/.env /tmp/flecblog-backup/.env
   cp -r <数据卷路径> /tmp/flecblog-backup/
   docker exec <容器名> pg_dump -U postgres -d postgres > /tmp/flecblog-backup/flecblog.sql
   
   # 停止 Docker
   cd <compose目录> && docker compose down
   
   # 复制配置和数据
   cp <compose目录>/.env ${INSTALL_DIR}/.env
   cp -r <数据卷路径>/uploads ${INSTALL_DIR}/uploads
   
   # 修改 DB_HOST
   sed -i 's/DB_HOST=postgres/DB_HOST=localhost/' ${INSTALL_DIR}/.env
   ```
8. 询问 Server 端口和 Blog 端口（从原 .env 读取默认值）
9. 提示用户选择 PostgreSQL 部署方式：
   - A. 宿主机原生安装（提供安装命令 + 导入命令）
   - B. Docker 单独运行（提供 `docker run` 命令）
   - C. 手动配置（跳过）
10. 生成 `ecosystem.config.js`，启动服务

**关键逻辑**：
- 不解析 `docker-compose.yml`，改为询问路径（降低复杂度）
- 自动修改 `DB_HOST` 从 `postgres` 改为 `localhost`

---

### 模式 3：flecb 迁移

**与模式 2 的差异**：
- 最后一步增加卸载 flecb：
  ```bash
  if command -v flecb &>/dev/null; then
    info "正在卸载 flecb..."
    flecb uninstall
  fi
  ```

---

### 模式 4：手动迁移

**纯指导模式**，不执行任何操作，仅打印：
```
========================================
  手动迁移指南
========================================

1. 备份旧系统数据：
   - 配置文件（.env）
   - 上传文件（/uploads）
   - 数据库（pg_dump）

2. 准备 PostgreSQL 数据库并导入备份

3. 将备份的 .env 复制到 ${INSTALL_DIR}/.env

4. 修改 .env 中的 DB_HOST 和端口配置

5. 将上传文件复制到 ${INSTALL_DIR}/uploads

6. 运行：pm2 start ecosystem.config.js

详细步骤参考文档：
https://github.com/talen8/FlecBlog/tree/main/docs
========================================
```

---

## 主交互流程

**脚本启动后**：
```
========================================
  FlecBlog 安装向导
========================================

请选择部署模式：
  1) 全新安装（首次部署，需配置数据库）
  2) 从 Docker Compose 迁移
  3) 从 flecb 迁移
  4) 手动迁移（仅显示指南）

请输入选项 [1-4]: _
```

---

## 需要删除的代码

### Server 端

| 文件 | 操作 |
|------|------|
| `server/cmd/setup/index.html` | 删除整个文件 |
| `server/cmd/setup/embed.go` | 删除整个文件（如果存在） |
| `server/cmd/main.go` | 删除 `startSetupServer()` 函数（108-131 行）<br>删除 `serveSetupStatic()` 函数（134-142 行）<br>删除 52-55 行的 setup 模式判断<br>删除 89-90 行的 setup 轮询端点 |
| `server/api/v1/setup.go` | 删除整个文件 |
| `server/config/config.go` | 删除 `IsSetupNeeded()` 方法（171-174 行） |
| `server/api/router/router.go` | 无需修改（setup 路由在 main.go 中单独注册） |

### 安装脚本

| 文件 | 操作 |
|------|------|
| `install.js` | 重构为 4 模式交互式流程 |

### 文档

| 文件 | 操作 |
|------|------|
| `docs/docker-to-native-migration.md` | 精简为纯概念说明，详细步骤由脚本引导 |

---

## 安装脚本函数结构

```
main()
├── show_mode_selection()        # 显示模式选择菜单
├── mode_fresh_install()         # 模式 1
│   ├── ask_database_config()
│   ├── test_db_connection()
│   ├── ask_jwt_secret()
│   ├── ask_ports()
│   ├── confirm_config()
│   └── write_env_and_start()
├── mode_docker_migration()      # 模式 2
│   ├── ask_compose_path()
│   ├── parse_env_file()
│   ├── ask_volume_path()
│   ├── ask_container_name()
│   ├── confirm_migration_plan()
│   ├── backup_docker_data()
│   ├── stop_docker()
│   ├── copy_data()
│   ├── fix_db_host()
│   ├── ask_postgres_deployment()
│   └── write_env_and_start()
├── mode_flecb_migration()       # 模式 3（复用模式 2 + 卸载）
│   ├── mode_docker_migration()
│   └── uninstall_flecb()
└── mode_manual_migration()      # 模式 4
    └── print_manual_guide()
```

---

## 风险评估

### 高风险点

1. **数据库连接测试失败处理**
   - 缓解：提供清晰的错误信息（权限、网络、版本）
   - 缓解：允许跳过测试（高级用户）

2. **Docker 数据迁移中断**
   - 缓解：先备份到 `/tmp/flecblog-backup`
   - 缓解：每步操作前显示计划并要求确认

3. **端口冲突未检测到**
   - 缓解：`ss -tlnp` 不可用时警告用户手动检查
   - 缓解：启动失败时提示查看 `pm2 logs`

### 用户体验风险

1. **交互过长导致用户放弃**
   - 缓解：提供合理默认值（回车跳过）
   - 缓解：全新安装模式步骤不超过 5 个输入

2. **错误信息不够友好**
   - 缓解：每个错误都附带解决建议
   - 缓解：提供「回退到手动模式」选项

---

## 实施步骤

### 阶段 1：Server 端清理
1. 删除 `server/cmd/setup/` 目录
2. 删除 `server/api/v1/setup.go`
3. 修改 `server/cmd/main.go`（移除 setup 模式）
4. 修改 `server/config/config.go`（移除 `IsSetupNeeded()`）
5. 验证构建：`cd server && go build -v ./...`

### 阶段 2：安装脚本重构
1. 实现 `show_mode_selection()`
2. 实现模式 4（手动迁移，最简单）
3. 实现模式 1（全新安装，核心流程）
4. 实现模式 2（Docker 迁移）
5. 实现模式 3（flecb 迁移，基于模式 2）
6. 本地虚拟机测试四种模式

### 阶段 3：文档更新
1. 精简 `docs/docker-to-native-migration.md`
2. 更新 `README.md` 安装部分
3. 更新 `hub/` 文档门户

---

## 后续优化点（非本次实施）

- 支持从环境变量预填配置（`FLECBLOG_DB_HOST` 等），实现无交互安装
- 增加 `--mode` 参数跳过模式选择菜单
- 增加 `--dry-run` 参数预览操作不执行
- 日志文件记录安装过程（`/tmp/flecblog-install.log`）

---

## 审核要点

1. **架构决策**：是否同意删除 setup 网页，将配置前移到脚本？
2. **Docker 迁移方案**：是否接受交互式询问路径而非自动解析 YAML？
3. **PostgreSQL 部署方式**：是否由用户自主选择（原生/Docker/手动）？
4. **错误处理策略**：循环重试 vs 直接失败退出？
5. **安全性**：`.env` 文件权限设为 `0600` 是否足够？
