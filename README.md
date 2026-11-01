# StudyMY Monorepo

## 项目概览
StudyMY 是一个面向马来西亚留学选校、申请规划与内容管理的全栈项目，包含三个端：
- 前台站点：Vue 3 + Vite + Pinia + Vue Router + vue-i18n
- API 服务：NestJS + TypeORM + MySQL 8.0，可选 Redis 缓存
- 管理后台：Vue 3 + Vite + Pinia + Vue Router + Element Plus

当前管理后台已经完成从 Next.js 迁移到 Vue 3。
旧版 Next.js 管理后台代码已移动到 `apps/admin/deprecated-next`，仅作历史留档，禁止继续用于开发或生产部署。

## 功能范围
- 前台院校库、专业库、详情页、收藏、对比、自助申请与会员工作台
- 后台学校、专业、内容、多语言字段、学生申请、权限、菜单、系统设置管理
- 英语、马来语、中文简体、中文繁体四语内容结构
- 学校与专业数据录入、发布、筛选、查询与后台维护
- 学生申请数据、跟进记录、负责人分配、导出与日志记录

## 文档与编码约定
- 所有文档默认使用中文
- 项目源码、配置、文档统一使用 UTF-8 无 BOM
- 不使用 GBK、ANSI、UTF-16 保存项目文件
- Windows 11 + Codex 环境下，写文件优先使用 UTF-8 无 BOM，避免 PowerShell 默认 BOM 污染
- 若终端中文显示异常，先判断是否只是终端编码问题，不要把源码改成 GBK

## 环境变量
先复制 `.env.example` 为 `.env`，再按本地环境修改。

关键变量说明：
- `MYSQL_PORT=5306`
- `API_PORT=3000`
- `VITE_API_BASE_URL=http://localhost:3000/api`
- `VITE_ADMIN_API_BASE_URL=/api`
- `VITE_ADMIN_PROXY_TARGET=http://localhost:3000`
- `ADMIN_BASE_URL=http://localhost:3001`

说明：
- 前台默认直接访问 `VITE_API_BASE_URL`
- 管理后台开发模式默认通过 Vite 代理把 `/api` 转发到 `VITE_ADMIN_PROXY_TARGET`
- 管理后台如果独立部署，也可以把 `VITE_ADMIN_API_BASE_URL` 改成完整 API 地址

## 依赖服务
- MySQL 8.0
- Redis，可选；只有配置 `REDIS_URL` 时启用

## 安装依赖
```bash
npm install
```

## 初始化数据库与种子数据
```bash
npm run seed
```

默认账号：
- 管理员：运行种子前通过 `STUDYMY_SEED_ADMIN_PASSWORD` 配置，不提供默认密码。
- 演示学生：`demo@studymy.local / Demo123!`

## 本地开发
启动 API：
```bash
npm run dev:api
```

启动前台：
```bash
npm run dev:web
```

启动管理后台：
```bash
npm run dev:admin
```

管理后台本地地址：
- `http://localhost:3001`

## 构建
全部构建：
```bash
npm run build
```

单独构建管理后台：
```bash
npm run build --workspace @studymy/admin
```

单独预览管理后台构建产物：
```bash
npm run preview --workspace @studymy/admin
```

## 使用 PM2 部署 API

在服务器项目根目录执行，使用同一个部署用户管理 PM2：

```bash
npm install -g pm2
npm ci
npm run build:api
npm run start:prod
npm run status:prod
```

启动前配置根目录 `.env` 的数据库连接、`JWT_SECRET` 和 `API_PORT`。例如 `API_PORT=20026` 时，Nginx 将 `api.example.com` 的请求转发到 `http://127.0.0.1:20026`，并保留 `/api` 路径。启动前需确保数据库表结构已准备好；API 不会自动同步表结构。

根目录 `ecosystem.config.cjs` 管理 `studymy-api` 单进程，直接运行 `apps/api/dist/main.js`。工作目录固定为 `apps/api`，根目录 `.env` 由现有环境加载器读取；`package.json` 的启动、重启命令通过 `--env production` 选择 `env_production`，设置 `NODE_ENV=production`，端口沿用 `.env`。已有进程环境变量优先于 `.env`，修改配置时也需检查服务器已有变量。

API 监听成功后通知 PM2 就绪。停止或重启时响应 `SIGINT`、`SIGTERM`，执行 NestJS 关闭钩子释放数据库和 Redis 连接；PM2 最多等待 10 秒后强制结束进程。当前为单进程模式，重启会短暂中断服务。

更新代码或 `.env` 后：

```bash
npm ci
npm run build:api
npm run restart:prod
npm run status:prod
```

健康检查（端口应与 `.env` 一致）：

```bash
curl -f http://127.0.0.1:20026/health
```

查看日志：

```bash
npm run logs:prod
```

按 `Ctrl+C` 退出日志查看，不会停止 API。需要停止 API 时执行：

```bash
npm run stop:prod
```

Linux 服务器配置开机恢复：

```bash
pm2 startup
# Run the command printed by PM2, then save the running process list.
pm2 save
```

日志默认保存在部署用户的 `~/.pm2/logs`。API 更新后可再次执行 `pm2 save` 保存进程列表。前端仍需单独构建并通过 Nginx 等静态服务器部署。

## 管理后台迁移说明
- 当前 admin 正式代码目录：`apps/admin/src`
- 当前 admin 技术栈：Vue 3 + Vite + Element Plus
- 旧版 Next 管理后台归档目录：`apps/admin/deprecated-next`
- 根脚本 `dev:admin` 已指向 Vue 3 管理后台
- 不再保留任何 Next.js 管理后台启动脚本

## 当前后台能力
管理后台已经具备以下模块：
- 登录认证与登录态持久化
- 管理员、角色、权限点、菜单管理
- 基于角色的菜单与权限控制
- 学校管理与四语字段录入
- 专业管理与四语字段录入
- 内容管理与 CMS 文案录入
- 学生申请管理、跟进记录、负责人分配
- 系统配置、字典项、操作日志
- 仪表盘统计概览

## 注意事项
- NestJS API 服务使用 `synchronize: false`，启动时不会自动同步数据库表结构；后续表结构变更需通过数据库迁移管理。独立种子和导入脚本使用各自的数据库连接配置。
- Redis 是可选增强层，不配置不会影响基本功能
- 如果本地 3000 端口上跑的是旧 API 进程，请先停止旧进程再启动最新代码
- 管理后台联调请优先使用 `npm run dev:api` 与 `npm run dev:admin` 的同一批最新代码，避免旧进程导致接口不一致
