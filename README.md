# 慧对接 SmartConnect

向割韭菜说不，为您精准匹配好项目。

C 端小程序 + B 端后台 + 总后台，三端覆盖项目展示、合作对接、资源互换的全流程平台。

---

## 目录结构

```
smartconnect/
├── docs/                   # 产品文档
│   ├── PRD.md              # 产品需求
│   ├── ARCHITECTURE.md     # 架构设计
│   ├── API.md              # 接口规范（66 端点）
│   ├── DATA_MODEL.md       # 数据模型 + 状态机
│   ├── PERMISSION.md       # 权限矩阵 + 隐私边界
│   └── TASKS.md            # 任务拆分与排期
├── server/                 # NestJS + Prisma + PostgreSQL
│   ├── prisma/             # Schema + 种子数据 + RLS
│   └── src/
│       ├── auth/           # JWT + wx-login + B 端登录
│       ├── tenant/         # 多租户上下文（RLS 双层隔离）
│       ├── prisma/         # PrismaService
│       ├── modules/        # home/project/me/admin
│       └── common/         # 守卫/拦截器/过滤器/装饰器
├── miniapp/                # 微信小程序（原生 TS）
│   ├── pages/              # home / project-list / project-detail / me
│   ├── components/         # ScoreBar（三维评分组件）
│   └── utils/              # 请求封装 + 登录
└── web/                    # B 端 + 总后台（React + Vite + Ant Design）
    └── src/
        ├── api/            # Axios 客户端
        ├── layouts/        # 侧栏布局（B 端 / 总后台切换）
        └── pages/          # Login / Dashboard / ProjectList / UserData
                            # AdminB / AdminProject / AdminDashboard
```

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | NestJS + Prisma + PostgreSQL + Redis |
| 小程序 | 原生微信小程序 + TypeScript |
| B 端/总后台 | React 18 + Vite + Ant Design 5 + TanStack Query |
| 部署 | Docker + Nginx |

## v0.1 功能范围

- **C 端小程序**: 微信登录、首页（数据框 + 广告语 + 动态）、项目列表/搜索/详情、免费加入、收藏、个人中心
- **B 端后台**: 登录（含首登初始化）、项目 CRUD、用户数据（浏览/加入/下级）、看板
- **总后台**: B 端管理、项目审核（含初始评分）、全局看板
- **基础设施**: 多租户双层隔离（ORM + RLS）、JWT 鉴权、统一响应信封

> v0.2 计划：微信支付、BP 付费解锁、付费加入、一级分佣  
> v0.3 计划：评分聚合、资源互换、合伙人、千人千面专属页

## 快速开始

### 前置
- Node.js >= 22
- pnpm >= 10
- PostgreSQL + Redis

### 启动后端
```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL、JWT_SECRET 等

# 初始化数据库
cd server
npx prisma migrate dev
npx prisma db seed

# 启动开发服务器（:3000）
pnpm dev:server
```

### 启动前端
```bash
# B 端后台（:5173，代理 /api → :3000）
pnpm dev:web

# 小程序（在微信开发者工具中打开 miniapp/）
```

### 验证
```bash
curl http://localhost:3000/api/health
# {"success":true,"data":{"status":"ok"},"error":null,"meta":null}
```

## 设计要点

- **多租户隔离**: 应用层 ORM 过滤 + PostgreSQL RLS 兜底，双层保障数据安全
- **租户信任**: `X-B-ID` 仅作入口线索，登录态以 JWT claim 为准
- **模块化单体**: 支付、通知先为模块，同进程部署，高负载后沿边界拆微服务
- **权限矩阵**: B 端查看 C 端用户分四类（浏览/加入/下级/资源广场），字段按需暴露

## 文档

| 文档 | 链接 |
|---|---|
| 产品需求 | [docs/PRD.md](./docs/PRD.md) |
| 架构设计 | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| 接口规范 | [docs/API.md](./docs/API.md) |
| 数据模型 | [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) |
| 权限隐私 | [docs/PERMISSION.md](./docs/PERMISSION.md) |
| 任务排期 | [docs/TASKS.md](./docs/TASKS.md) |
