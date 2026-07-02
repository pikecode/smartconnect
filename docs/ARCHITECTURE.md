# 慧对接 SmartConnect — 架构设计文档

> 版本: v1.1  ·  日期: 2026-07-01  ·  状态: 草案
> 相关文档: [PRD.md](./PRD.md)  ·  [DATA_MODEL.md](./DATA_MODEL.md)(数据表/状态机)  ·  [PERMISSION.md](./PERMISSION.md)(权限/隐私)  ·  [API.md](./API.md)(接口规范)

> 数据表字段、状态机已拆至 [DATA_MODEL.md](./DATA_MODEL.md);权限矩阵、字段边界、隐私规则已拆至 [PERMISSION.md](./PERMISSION.md)。本文档保留架构总览、多租户、API、业务流程。

---

## 1. 架构总览

### 1.1 系统拓扑

> **MVP 形态: 模块化单体**。支付、通知先作为**模块**而非独立服务,符合 YAGNI/KISS。高负载后再拆。

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  C端小程序       │   │  B端后台(Web)    │   │  总后台(Web)     │
│  (微信小程序)    │   │  (PC浏览器)      │   │  (PC浏览器)      │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   API 网关层         │
                    │   (鉴权/限流/路由)   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
       │ 模块化单体   │  │  Redis      │  │  OSS/CDN   │
       │ API进程      │  │  (缓存/会话) │  │ (静态资源)  │
       │ ┌─────────┐  │  └─────────────┘  └────────────┘
       │ │业务模块 │  │
       │ ├─────────┤  │
       │ │支付模块 │  │  (微信支付/分账)
       │ ├─────────┤  │
       │ │通知模块 │  │  (消息/推送)
       │ └─────────┘  │
       └──────┬───────┘
              │
       ┌──────▼──────┐
       │ PostgreSQL  │
       │ (主数据+RLS) │
       └─────────────┘
```

**模块边界(进程内)**: 业务/支付/通知各为独立模块,接口清晰,但同进程部署。后期可沿边界拆为微服务。

### 1.2 技术选型(建议)

| 层 | 选型 | 理由 |
|---|---|---|
| 小程序 | 原生微信小程序 + TypeScript | 性能优,参数渲染多租户灵活 |
| B端/总后台 Web | React + Vite + Ant Design | PC管理台成熟方案 |
| 后端 | Node.js + NestJS 或 Python + FastAPI | 团队偏好定;NestJS模块化强 |
| DB | PostgreSQL | 多租户行级隔离,JSON字段支持模板 |
| 缓存 | Redis | 会话/热门项目/限流 |
| 支付 | 微信支付 API v3 | 平台收口,分账接口 |
| 部署 | Docker + 云服务器 + Nginx | 早期单机够用 |
| 对象存储 | 阿里云OSS/腾讯云COS + CDN | BP文档/图片 |

> ⚠️ 技术选型待团队确认。下方架构与语言无关。

---

## 2. 多租户架构

### 2.1 隔离方案: 共享DB共享Schema + 双层隔离

每张业务表带 `b_id`(B端ID)字段。隔离分两层,**缺一不可**:

| 层 | 机制 | 职责 |
|---|---|---|
| 应用层 | ORM 全局拦截器自动注入 `WHERE b_id=?` | 日常开发默认安全 |
| 数据库层 | PostgreSQL **RLS (Row Level Security)** | 兜底: 应用层漏注时DB仍拦截 |

**RLS 要点**:
- **租户表**(带 `b_id`)启用 `ROW LEVEL SECURITY`,策略 `USING (b_id = current_setting('app.b_id')::bigint)`
- **平台级表**(`c_user`、`user_resource`、`wechat_swap` 等,不带 `b_id`)**不启用 b_id RLS**,改由应用层权限、字段脱敏和业务授权控制(如资源列表对全平台可见,微信字段需互换授权)
- 应用连接DB时 `SET LOCAL app.b_id = ?`(事务级会话变量)
- 迁移/统计脚本必须显式 `SET LOCAL` 或用 superuser 连接绕过(审计)

> 仅靠应用层会在新接口、后台脚本、统计查询中漏加 `b_id`。RLS 作为兜底,符合 KISS 但补齐安全边界。

### 2.2 租户上下文(信任来源)

> ⚠️ **关键修正**: `X-B-ID` 请求头**不可直接信任**,用户可篡改访问其他B端数据。

租户上下文必须由服务端从可信来源解析:

| 可信来源 | 适用场景 |
|---|---|
| 登录态(JWT claims) | 已登录C端,claim含当前 `tenant_context.b_id` |
| 用户-B端关系 | 服务端查 `user_tenant_relation`(用户与B端关系),不取请求头 |
| scene 签名 | 小程序码 scene 由后端签发,前端不可伪造 |

**解析流程**:
```
小程序入口 → scene/URL 携带 b_id(仅作入口线索,不可信)
           → 首次注册: 服务端校验 b_id 存在性 + scene签名
              → 写入 user_tenant_relation(user_id, b_id, relation_flags=primary)
           → 登录后: JWT claim 携带 tenant_context.b_id(当前会话租户)
           → 请求到达: 网关从 JWT 解析 b_id(不读 X-B-ID)
           → 中间件: SET LOCAL app.b_id → RLS 生效
```

> **X-B-ID 规则**: 仅**未登录公开请求**(如B端专属项目展示页)可带入口 `b_id` 作为线索,服务端必须校验其公开属性。**登录后所有请求以 JWT/服务端会话为准**,忽略 `X-B-ID`。

### 2.3 C端用户身份模型(关键拆分)

> ⚠️ **修正**: 单一 `c_user.b_id` 归属与"全平台用户资源列表"冲突。

C端用户是**平台全局身份**,与B端是**访问/归属关系**,不是从属:

```
c_user (全局身份)          ── openid/phone 全局唯一
  └─ user_tenant_relation  ── 用户与B端的关系(N:N)
       ├─ b_id             ── 关联B端
       ├─ relation_flags   ── 位掩码: primary/visited/joined 可叠加
       ├─ entry_source     ── platform / b_only (功能范围)
       └─ parent_user_id   ── 该B端内的推荐上级(一级)
```

**资源列表查询**: 全平台用户(`c_user`全局)资源可见,资源主体不按租户隔离。资源/需求表(`user_resource`)主体不带 b_id;`b_only` 可见性通过 `visible_b_id` 限定到指定 B 端(见 [DATA_MODEL.md](./DATA_MODEL.md) §3.4)。

**分佣/推荐**: `user_referral` 仍保持一级,但 `referrer_id`/`referred_id` 关系限定在特定 `b_id` 上下文内(同一B端内推荐)。

### 2.4 C端入口识别

| 入口 | 标识 | 功能范围 |
|---|---|---|
| 慧对接主入口 | `entry_source=platform` | 全功能 |
| B端专属入口 | `entry_source=b_only` | 项目介绍 + 我的(认证+下级) |

`entry_source` 存于 `user_tenant_relation`,控制功能可见性。

---

## 3. 数据模型(核心表)

### 3.1 ER 概览

```
platform_admin ──┐
                 │
b_tenant ────────┤ (B端=城市运营中心=项目方)
  │               │
  ├─ project ─────┤
  │   ├─ project_template (标准模板字段)
  │   ├─ project_score (三维评分)
  │   ├─ project_expert_analysis (专家分析)
  │   └─ project_dynamic (合作动态)
  │
  ├─ city_center (城市运营中心信息)
  │
  └─ b_order (B端支付订单)

c_user ──────────┐ (平台全局身份,不带b_id)
  │               │
  ├─ user_kyc (实名认证,敏感加密,1:1)
  ├─ user_tenant_relation (用户↔B端关系,带b_id)
  ├─ user_auth (认证信息)
  ├─ user_resource (资源/需求,平台级,不带b_id)
  ├─ user_favorite (收藏: 项目/运营中心)
  ├─ user_join (加入项目记录)
  ├─ user_referral (推荐关系,一级,限定b_id内)
  ├─ user_score_review (项目评价)
  └─ c_order (C端支付: BP/加入/合伙人)

wechat_swap (微信互换申请,平台级)
commission (分佣记录,带状态机)
```

### 3.2 关键表结构 → 见 [DATA_MODEL.md](./DATA_MODEL.md)

> 数据表字段、订单/佣金/互换状态机、数据字典已拆至独立文档,避免双份维护。

---

## 4. API 设计

### 4.1 规范
- RESTful
- 统一响应信封:
```json
{ "success": true, "data": {}, "error": null, "meta": {} }
```
- 鉴权: JWT (C端用openid换token,claim含 `tenant_context.b_id`; B端/总后台用账号密码)
- 租户上下文: 服务端从 JWT claim 解析当前 `tenant_context.b_id`(由 `user_tenant_relation` 解析),**不信任 `X-B-ID` 请求头**。无登录态公开页才用 `X-B-ID`,且服务端校验其公开属性。

### 4.2 核心接口分组

| 分组 | 前缀 | 说明 |
|---|---|---|
| C端-首页 | `/api/c/home` | 数据框/动态 |
| C端-项目 | `/api/c/project` | 列表/详情/搜索/评分 |
| C端-合作 | `/api/c/coop` | 运营中心/入圈/合伙人 |
| C端-资源 | `/api/c/resource` | 用户列表/互换 |
| C端-我的 | `/api/c/me` | 认证/收藏/加入/下级/佣金 |
| C端-支付 | `/api/c/pay` | 下单/回调 |
| B端-项目 | `/api/b/project` | CRUD |
| B端-用户 | `/api/b/user` | 列表/审核/数据 |
| B端-财务 | `/api/b/finance` | 分佣 |
| 总后台-B端 | `/api/admin/b` | B端管理 |
| 总后台-数据 | `/api/admin/data` | 数据看板 |
| 总后台-模块 | `/api/admin/module` | 模块开关 |

### 4.3 关键接口示例

#### 项目详情
```
GET /api/c/project/:id
Auth: JWT (claim解析b_id,无登录态则按公开页校验)
Response: 项目完整模板 + 评分 + 专家分析 + (BP仅会员可见标记)
```

#### 加入项目(付费)
```
POST /api/c/project/:id/join
→ 创建 c_order(type=join_project, status=created)
→ 微信支付 → paid → delivered
→ delivered: 解锁项目方联系信息 + 记录user_join + commission:pending
```

#### 推荐关系绑定
```
POST /api/c/auth/register
Body: { phone, code, invite_user_id, scene_b_id, scene_sig }
→ 服务端校验 scene_sig 签名(防篡改b_id)
→ 创建 c_user + user_tenant_relation + user_referral(一级,限定b_id)
```

---

## 5. 关键业务流程

### 5.1 千人千面渲染

```
用户扫B端小程序码
  → 小程序 onLaunch 解析 scene → b_id(入口线索)
  → 存全局 context(前端上下文)
  → 未登录公开请求: 可带 X-B-ID 作入口线索(服务端校验公开属性)
  → 登录后: JWT claim 携带 tenant_context.b_id,以 JWT 为准
  → 首页: 返回该B端项目浏览数/最近用户/动态
  → 项目页: 仅该B端项目,无类别/搜索
  → 我的: 仅认证+下级(若 entry_source=b_only)
```

### 5.2 项目评分动态生成

**公式**(归一化到0-100):
```
最终分 = 平台初始分 × W_init + 用户均分 × W_user

W_init = 0.4, W_user = 0.6 (默认)
当 评价数 < MIN_REVIEWS(=3) 时: W_user = 0, W_init = 1.0 (仅平台分)
```

**分数方向(关键)**:
- 真实性(绿)/盈利性(金): 分越高越好
- 风险性(红): 分**越高代表风险越大**(100=极高风险),展示需配套警示文案

**流程**:
```
项目首次发布 → 平台打初始分(authenticity/risk/profitability)
用户加入项目且时长>24h → 获评价权限
用户提交评价 → 五星转0-100分
  → 异步聚合: 按上述公式重算
  → 异常评价过滤(同IP/设备批量→标记可疑,不纳入)
  → 更新 project_score
  → 缓存失效
```

**风控**: 平台可对单项目评分重置/锁定。

### 5.3 一级分佣(含冲正闭环)

```
用户A分享二维码(带 invite_user_id + b_id签名)
  → 用户B注册(parent=A, b_id绑定至user_tenant_relation)

用户B付费(加入项目/BP解锁)
  → c_order: created → pending → paid → delivered(发货)
  → delivered 时: 立即创建 commission(status=pending)  [不待风控期]
  → 风控期(T+1)内无异常 → commission: pending → settled(可提现)
  → 风控期内异常/申诉 → commission: pending → frozen

退款冲正:
  c_order refunded → commission → reversed(扣回佣金)
  已settled的佣金遇退款 → 生成负向commission或从后续佣金抵扣

提现:
  用户提现 → 实名校验 + 限额 → 打款
```

> **时序约定**: `commission` 在订单 `delivered` 时**立即创建为 pending**,不等风控期。T+1 风控期通过后 `pending → settled`。与订单状态机一致。

### 5.4 微信支付流

```
C端下单 → 后端创建订单 + 微信预支付单
  → 返回支付参数 → 小程序调起支付
  → 微信回调后端
  → 校验签名 + 更新订单状态
  → 发货(解锁BP/联系信息/加入记录)
  → 触发分佣
```

> 平台收口: 资金进平台账户,通过微信分账接口分给B端+分佣C端。

### 5.5 微信互换

```
用户A 查看用户B → 微信不可见
用户A 申请互换 → wechat_swap(pending)
用户B 互换设置:
  auto_approve → 自动approved
  manual_review → 用户B手动审核
approved → 双方互见微信
```

---

## 6. 安全设计

| 风险 | 措施 |
|---|---|
| 多租户越权 | **双层**: 应用层ORM全局拦截 `WHERE b_id=?` + **PostgreSQL RLS 兜底**;统计脚本审计 |
| 租户头篡改 | `X-B-ID` 不可信,租户上下文从 JWT claims / 服务端会话 / scene签名解析 |
| BP内容泄漏 | 后端校验付费状态,不返回bp_content给非会员 |
| 企查查链接XSS | 链接白名单校验(qcc.com域名),转义输出 |
| 支付篡改 | 微信签名校验,订单金额服务端生成 |
| 越权访问B端后台 | RBAC + JWT角色校验 |
| 接口刷量 | Redis限流(用户级+IP级) |
| 密码安全 | bcrypt哈希;B端首登用短信一次性链接设密,无静态默认密码 |
| 分佣风控 | 订单退款→佣金自动冲正(reversed);异常订单佣金冻结(frozen);提现校验 user_kyc |
| 敏感信息 | 实名/身份证拆 user_kyc 独立表,AES加密+哈希;仅提现/风控模块可访问,普通查询不返回 |
| 提现欺诈 | 提现需 user_kyc 审核通过;单笔/日累计限额;风控可冻结账户 |

---

## 7. 性能与扩展

| 项 | 方案 |
|---|---|
| 首屏 | 小程序分包加载,首页数据并行请求 |
| 项目列表 | 分页 + Redis缓存热门项目 |
| 评分聚合 | 异步队列计算,不阻塞请求 |
| 搜索 | PostgreSQL全文索引;后期可引Elasticsearch |
| 静态资源 | OSS+CDN(BP文档/图片) |
| 扩展 | 模块化单体先行,沿模块边界(支付/评分/通知)拆为微服务;高负载模块优先拆 |

---

## 8. 部署架构(早期)

```
云服务器单机
  ├─ Nginx (反向代理 + HTTPS)
  ├─ Docker: API服务
  ├─ Docker: PostgreSQL
  ├─ Docker: Redis
  └─ OSS (外部)

CI/CD: GitHub Actions → 构建镜像 → 部署
```

后期B端规模化 → 拆分DB/服务,引入负载均衡。

---

## 9. 待确认决策表

| 项 | 选项 | 默认建议 | 影响 |
|---|---|---|---|
| 后端语言/框架 | NestJS / FastAPI | NestJS | 模块化+TS全栈 |
| 分佣比例配置方 | 平台定 / B端自定 | 平台设定上限,B端内选 | 财务逻辑 |
| 结算周期 | T+1 / T+7 / 手动 | T+1自动+手动补结 | 佣金状态机 |
| BP文档格式 | 纯文本 / PDF / 富文本 | 富文本+PDF附件 | 存储与渲染 |
| 专家分析录入 | 平台后台手填 / SOP流程 | 平台后台富文本 | 内容运营 |
| 小程序主体 | 主小程序+B端scene / 多小程序 | 主小程序+scene | 千人千面实现 |
| 分佣比例数值 | 待定 | 待业务定 | 财务 |
| 提现限额 | 单笔/日累计 | 单笔≥10元,日≤5000 | 风控 |
| RLS 是否启用 | 启用 / 仅应用层 | 启用(双层) | 安全边界 |

---

## 10. 权限与隐私 → 见 [PERMISSION.md](./PERMISSION.md)

> 权限矩阵、B端可见C端用户字段边界、资源广场隐私规则、举报与封禁流程已拆至独立文档。

---

## 11. MVP 验收标准

### 11.1 v0.1 MVP 范围
- C端: 首页 / 项目浏览 / 搜索 / 加入项目(免费) / 我的(认证+收藏+加入)
- B端: 项目CRUD / 用户列表 / 加入设置
- 总后台: B端管理 / 项目审核
- 基础: 微信登录 / 多租户隔离(双层) / 评分平台初始分

> v0.1 **不含** 微信支付、BP付费解锁、分佣、退款冲正(归 v0.2)。U5/U8/U9 移至 v0.2。

### 11.2 v0.1 验收用例
| ID | 用例 | 通过标准 |
|---|---|---|
| U1 | C端微信登录 | 首次登录创建c_user,绑定b_id(若有scene) |
| U2 | B端发布项目 | 填写模板→审核通过→项目上线(发布费v0.2接入支付,先人工) |
| U3 | C端浏览项目 | 可见公开字段,BP字段返回`locked`标记 |
| U4 | C端免费加入项目 | 加入设置=免费→记录user_join→解锁联系信息 |
| U6 | 多租户隔离 | B端A请求B端B项目→RLS拦截→403 |
| U7 | 租户头篡改 | C端改X-B-ID→服务端按JWT claim覆盖→无法越权 |
| U10 | 评分初始 | 新项目仅平台分,用户评价<3条时不混合 |
| U11 | B端首登 | 短信链接设密,无静态默认密码 |
| U12 | 资源列表 | 全平台用户资源可见,微信不可见 |

### 11.3 v0.2 验收用例(支付+分佣)
| ID | 用例 | 通过标准 |
|---|---|---|
| U5 | C端付费解锁BP | 微信支付→bp_content可见 |
| U8 | 一级分佣 | B付费→A获commission:pending(delivered即创建)→T+1→settled |
| U9 | 退款冲正 | 订单refund→commission→reversed |
| U2p | B端付费发布项目 | 填写模板→微信支付发布费→审核通过→上线 |
| U4p | C端付费加入项目 | 微信支付成功→解锁联系信息→user_join记录 |
