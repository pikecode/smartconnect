# 慧对接 SmartConnect — 任务拆分与排期

> 版本: v1.0  ·  日期: 2026-07-01  ·  范围: v0.1 MVP
> 对应: [PRD.md](./PRD.md)  ·  [ARCHITECTURE.md](./ARCHITECTURE.md)  ·  [API.md](./API.md)  ·  [DATA_MODEL.md](./DATA_MODEL.md)

---

## 1. v0.1 范围边界

### 1.1 包含
- C端小程序: 微信登录/手机绑定、首页(数据框+广告语+动态)、项目列表/详情/搜索、免费加入、收藏、我的(资料+收藏+加入+下级)
- B端Web: 登录(含首登初始化链接)、项目CRUD、用户列表(浏览/加入/下级)、数据看板骨架
- 总后台Web: B端管理(CRUD+费用上限)、项目审核、全局数据看板
- 后端: 多租户双层隔离(ORM+RLS)、JWT鉴权、租户上下文中间件、评分平台初始分
- DB: v0.1 所需表 + RLS 策略

### 1.2 不含(留 v0.2/v0.3)
- 微信支付、BP付费解锁、付费加入、分佣、退款、KYC、专家分析(v0.2)
- 合伙人、资源互换、入圈、模块管理、千人千面专属页(v0.3)

### 1.3 技术栈
| 层 | 选型 |
|---|---|
| 后端 | NestJS + Prisma + PostgreSQL + Redis |
| 小程序 | 原生微信小程序 + TypeScript |
| B端/总后台 Web | React + Vite + Ant Design + TanStack Query |
| 部署 | Docker + Nginx |

---

## 2. 任务依赖图

```
[T1 DB schema] ──┬─→ [T2 后端骨架] ──┬─→ [T4 C端API] ──→ [T7 小程序]
                 │                   ├─→ [T5 B端API] ──→ [T8 B端Web]
                 │                   └─→ [T6 总后台API]─→ [T8 总后台Web]
                 └─→ [T3 RLS+租户中间件] ─→ T4/T5/T6
```

关键路径: T1 → T2/T3 → T4 → T7

---

## 3. 任务清单

### T1: DB Schema 落地
**owner**: 后端 · **依赖**: 无 · **估时**: 1.5d

- [ ] Prisma schema 编写(v0.1 表: 见 DATA_MODEL §2.1-2.9 + §3.1-3.3 + 3.9-3.10)
- [ ] 枚举: audit_status / join_mode / entry_source / relation_flags / order_status 等
- [ ] 索引: project(b_id,category_id)、user_tenant_relation(user_id,b_id) UNIQUE、user_referral(referred_id,b_id) UNIQUE
- [ ] 种子数据: category 字典、1个测试B端+1个测试项目
- [ ] 验证: `npx prisma migrate dev` + `prisma studio` 查看数据

**完成标准**: migrate 成功,种子数据写入,`prisma generate` 通过

---

### T2: 后端脚手架
**owner**: 后端 · **依赖**: T1 · **估时**: 1d

- [ ] `nest new server` + 目录结构(app.module 分模块)
- [ ] Prisma 集成: `PrismaModule` + `PrismaService`(全局)
- [ ] 配置: `@nestjs/config`(.env: DATABASE_URL/REDIS_URL/JWT_SECRET)
- [ ] JWT 鉴权: `JwtModule` + `AuthGuard` + `@Public()` 装饰器
- [ ] 全局响应拦截器(统一信封) + 全局异常过滤器(错误码映射)
- [ ] 请求校验: `class-validator` + `ValidationPipe`
- [ ] 限流: `@nestjs/throttler`
- [ ] 健康检查: `GET /api/health`

**完成标准**: `pnpm start:dev` 起服务,`/api/health` 返回 200,统一信封生效

---

### T3: 多租户隔离 + 租户上下文
**owner**: 后端 · **依赖**: T1,T2 · **估时**: 1.5d

- [ ] `TenantContextService`: 从 JWT claim 解析 `tenant_context.b_id`
- [ ] Prisma 扩展: 自动注入 `WHERE b_id=?` 到租户表查询(查 [PERMISSION.md §7](./PERMISSION.md) 租户表清单)
- [ ] RLS 策略迁移: 租户表 `ENABLE ROW LEVEL SECURITY` + `POLICY ... USING (b_id = current_setting('app.b_id')::bigint)`
- [ ] 事务中间件: 每请求 `SET LOCAL app.b_id = ?`
- [ ] 平台级表豁免: c_user/user_resource/wechat_swap 等不启用 b_id RLS
- [ ] `X-B-ID` 处理: 仅 `@Public()` 端点读取并校验公开属性,登录态忽略
- [ ] 集成测试: B端A查B端B项目 → 403 `TENANT_002`

**完成标准**: 越权测试通过,RLS 兜底生效(注释掉应用层过滤仍被DB拦截)

---

### T4: C 端 API(v0.1 子集)
**owner**: 后端 · **依赖**: T2,T3 · **估时**: 2d

仅实现 API.md 中 `[v0.1]` 标注端点:
- [ ] `POST /api/c/auth/wx-login`(微信code换openid,自动注册,scene绑定)
- [ ] `POST /api/c/auth/bind-phone`(短信码,先用 mock 验证码)
- [ ] `GET /api/c/home`(stats+广告语+动态;B端入口返回专属数据)
- [ ] `GET /api/c/project`(列表+搜索+分类过滤)
- [ ] `GET /api/c/project/:id`(详情;BP字段 `locked=true` 不返回内容;联系信息未加入不返回)
- [ ] `POST /api/c/project/apply`(申请发布,audit_status=pending;v0.1 不支付)
- [ ] `POST/DELETE /api/c/project/:id/favorite`
- [ ] `POST /api/c/project/:id/join`(仅免费模式:join_mode=free → 直接 user_join + 解锁联系)
- [ ] `GET /api/c/me` / `PUT /api/c/me`
- [ ] `GET /api/c/me/favorites` / `GET /api/c/me/joined` / `GET /api/c/me/referrals`
- [ ] `GET /api/c/me/b-portal`(B端入口一次性链接)

**完成标准**: Postman/HTTPie 跑通所有端点,响应符合 API.md 信封,权限边界正确

---

### T5: B 端 API(v0.1 子集)
**owner**: 后端 · **依赖**: T2,T3 · **估时**: 1.5d

- [ ] `POST /api/b/auth/login`(账号密码;JWT 含 b_id)
- [ ] `POST /api/b/auth/init-password`(一次性 token 设密)
- [ ] `GET/POST/PUT/DELETE /api/b/project`(CRUD;join_price 受 fee_cap 约束)
- [ ] `PUT /api/b/project/:id/join-setting`
- [ ] `GET /api/b/user/views` / `GET /api/b/user/joined` / `GET /api/b/user/referrals`(字段按 PERMISSION §3)
- [ ] `GET /api/b/finance/dashboard`(骨架: join_count 等,无支付数据)

**完成标准**: B端登录→CRUD项目→查看用户数据 流程跑通

---

### T6: 总后台 API(v0.1 子集)
**owner**: 后端 · **依赖**: T2,T3 · **估时**: 1d

- [ ] `POST /api/admin/auth/login`
- [ ] `GET/POST/PUT/DELETE /api/admin/b`(B端CRUD;新增返回 init_token)
- [ ] `PUT /api/admin/b/:id/fee-cap`
- [ ] `GET /api/admin/data/dashboard`(全局统计)
- [ ] `PUT /api/admin/project/:id/audit`(approved 时可打初始分 → project_score)

**完成标准**: 总后台审核项目→打初始分→项目评分展示

---

### T7: 小程序前端(v0.1)
**owner**: 前端 · **依赖**: T4 · **估时**: 3d

- [ ] 工程初始化: 原生小程序 + TypeScript + 分包
- [ ] 全局: `app.ts` 解析 scene → 存 b_id 上下文;请求拦截器带 `Authorization`
- [ ] 页面: `home`(数据框/广告语/动态列表)
- [ ] 页面: `project-list`(分类标签+搜索框+列表)
- [ ] 页面: `project-detail`(模板全字段;BP locked 提示;联系信息按加入状态)
- [ ] 页面: `me`(资料/收藏/加入/下级 tab)
- [ ] 组件: `ScoreBar`(5格进度条,绿/红/金,风险性配套警示文案)
- [ ] 组件: `ProjectCard`
- [ ] 登录: 微信 `wx.login` → 后端 wx-login → 绑定手机号弹窗
- [ ] 请求封装: 统一信封解包 + 错误码 toast

**完成标准**: 真机预览跑通首页→项目→加入→我的 主流程

---

### T8: B端/总后台 Web(v0.1)
**owner**: 前端 · **依赖**: T5,T6 · **估时**: 3d

- [ ] 工程初始化: React + Vite + Ant Design + TanStack Query + React Router
- [ ] 通用: 布局(侧栏+顶栏)、登录页、统一请求封装
- [ ] B端: 项目管理(表格+新增/编辑抽屉)、用户数据(浏览/加入/下级 tab)、看板
- [ ] 总后台: B端管理(表格+新增)、项目审核(列表+审核弹窗带打分)、全局看板
- [ ] 首登初始化: `/init-password` 页(消费 init_token 设密)
- [ ] 权限路由: B端路由 `/b/*`、总后台 `/admin/*`,路由守卫

**完成标准**: B端登录→建项目→总后台审核→B端看到已审核项目

---

### T9: 部署与联调
**owner: 全栈 · **依赖**: T7,T8 · **估时**: 1d

- [ ] `docker-compose.yml`: postgres + redis + server + web
- [ ] Nginx 配置: HTTPS、`/api` 反代后端、静态资源
- [ ] `.env.example` + 启动文档 `README.md`
- [ ] 端到端冒烟: 注册→登录→建项目→审核→C端浏览→加入→收藏

**完成标准**: `docker compose up` 一键起,冒烟通过

---

## 4. 排期(并行)

| 周 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 |
|---|---|---|---|---|---|---|---|---|---|
| W1 | ■ | ■ | ■ | | | | | | |
| W2 | | | ■ | ■ | ■ | ■ | | | |
| W3 | | | | ■ | | | ■ | ■ | |
| W4 | | | | | | | ■ | ■ | ■ |

- 总估时: ~16 人日(单人);2人并行约 3-4 周
- T1-T3 串行(依赖),T4/T5/T6 并行(后端),T7/T8 并行(前端,依赖各自API)

---

## 5. 风险与待定

| 风险 | 缓解 |
|---|---|
| 微信小程序主体未定(scene签发需AppID) | 先用测试AppID,T7前申请正式主体 |
| 分佣比例未定 | v0.1不含分佣,不影响;v0.2前必须定 |
| RLS + Prisma 扩展兼容性 | T3 先做技术验证(spike),不通过则退回应用层强拦截+审计测试 |
| 短信网关未选 | T4 先 mock 验证码,集成时接阿里云/腾讯云短信 |
| 企查查链接白名单 | T4 校验 `qcc.com` 域名 |

---

## 6. 验收(对齐 ARCHITECTURE §11.2)

v0.1 验收用例: U1/U2/U3/U4/U6/U7/U10/U11/U12
详见 [ARCHITECTURE.md §11.2](./ARCHITECTURE.md)
