# 慧对接 SmartConnect — 接口规范(API.md)

> 版本: v1.0  ·  日期: 2026-07-01  ·  状态: 草案
> 对应: [PRD.md](./PRD.md)  ·  [ARCHITECTURE.md](./ARCHITECTURE.md)  ·  [DATA_MODEL.md](./DATA_MODEL.md)  ·  [PERMISSION.md](./PERMISSION.md)

---

## 1. 通用规范

### 1.1 协议与基线
- HTTPS only,RESTful,JSON 请求/响应
- 日期时间: ISO 8601 UTC(`2026-07-01T08:00:00Z`)
- 金额: 整数分
- 分页: `?page=1&page_size=20`,响应含 `meta.pagination`

### 1.2 统一响应信封
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 100 } }
}
```
错误时:
```json
{ "success": false, "data": null, "error": { "code": "BIZ_001", "message": "项目不存在", "details": {} }, "meta": null }
```

### 1.3 鉴权
| 端 | 方式 | Token 载体 |
|---|---|---|
| C端 | 微信openid换JWT | `Authorization: Bearer <jwt>` |
| B端 | 账号密码登录换JWT | 同上 |
| 总后台 | 账号密码登录换JWT | 同上 |

JWT claim: `{ uid, role, tenant_context: { b_id, entry_source } }`

### 1.4 租户上下文
- 登录态: 服务端从 JWT `tenant_context.b_id` 解析,**不读 `X-B-ID`**
- 无登录态公开页: 可带 `X-B-ID` 作入口线索,服务端校验公开属性
- 详见 [ARCHITECTURE.md §2.2](./ARCHITECTURE.md)

### 1.5 状态码
| HTTP | 含义 |
|---|---|
| 200 | 成功(GET/PUT/PATCH) |
| 201 | 创建成功(POST) |
| 204 | 无内容(DELETE) |
| 400 | 参数错误 |
| 401 | 未认证/token失效 |
| 403 | 无权限/租户越权(RLS拦截) |
| 404 | 资源不存在 |
| 409 | 状态冲突(如重复加入) |
| 422 | 业务校验失败(如未付费读BP) |
| 429 | 限流 |
| 500 | 服务端错误 |

### 1.6 错误码前缀
`AUTH_` 认证 · `BIZ_` 业务 · `PAY_` 支付 · `TENANT_` 租户 · `VAL_` 参数

### 1.7 版本归属标注
每个端点标 `[v0.1]`/`[v0.2]`/`[v0.3]`,与 PRD 版本规划一致。

---

## 2. C 端 — 认证 `/api/c/auth`

### 2.1 微信登录 **[v0.1]**
`POST /api/c/auth/wx-login`
```json
// Request
{ "code": "wx_jscode", "scene_b_id": 12, "scene_sig": "..." }  // scene_* 可空,仅B端入口
// Response 201
{ "token": "jwt...", "user": { "id": 1, "phone": null, "is_new": true } }
```
- 首次登录 `is_new=true`,自动注册并按 scene 绑定 user_tenant_relation
- 错误: `AUTH_001` code无效 · `TENANT_001` scene签名无效

### 2.2 绑定手机号 **[v0.1]**
`POST /api/c/auth/bind-phone`
```json
// Request
{ "phone": "13800138000", "sms_code": "123456" }
// Response 200
{ "user": { "id": 1, "phone": "138****8000" } }
```
- 错误: `AUTH_002` 短信码错误 · `BIZ_010` 手机号已绑定其他账号

### 2.3 推荐关系绑定(注册时)
> 融合在 2.1 wx-login 内,若 `scene_b_id` + `scene_sig` 有效且 invite_user_id 存在,自动写 user_referral。无独立端点。

---

## 3. C 端 — 首页 `/api/c/home`

### 3.1 首页数据 **[v0.1]**
`GET /api/c/home`
```json
// Response 200
{
  "stats": { "total_users": 12345, "recent_viewers": [{"id":1,"nickname":"张三","avatar":"url"}] },
  "slogan": "向割韭菜说不,为您精准匹配好项目",
  "dynamics": [{ "id":1, "project_id":5, "title":"...", "content":"...", "created_at":"..." }]
}
```
- B端专属入口(`entry_source=b_only`): 返回该B端项目浏览数/最近用户/动态,无全平台stats

### 3.2 广告语
> 含在 3.1 响应,无独立端点。

---

## 4. C 端 — 项目 `/api/c/project`

### 4.1 项目列表 **[v0.1]**
`GET /api/c/project?page=1&page_size=20&category_id=2&keyword=AI&region=杭州`
```json
// Response 200
{
  "items": [{
    "id": 1, "title": "...", "one_liner": "...", "category": {"id":2,"name":"AI"},
    "score": { "authenticity": 80, "risk": 30, "profitability": 70 },
    "join_mode": "free", "join_price": 0, "bp_price": 9900,
    "cover": "url"
  }]
}
```
- B端专属入口: 仅返回该B端项目,忽略 category/keyword
- 错误: `VAL_001` 分页参数错误

### 4.2 项目详情 **[v0.1]**
`GET /api/c/project/:id`
```json
// Response 200
{
  "id": 1, "title": "...", "one_liner": "...", "intro": "...", "vision": "...",
  "goals": "...", "team": "...", "technology": "...", "competition": "...",
  "requirements": "...", "swot": {...}, "company_info": {...},
  "qcc_url": "https://www.qcc.com/firm/xxx", "founder_intro": "...", "origin_story": "...",
  "score": { "authenticity": 80, "risk": 30, "profitability": 70, "review_count": 5 },
  "expert_analysis": { "content": "..." },  // [v0.2] 平台产出
  "join_requirement": "...", "join_mode": "free", "join_price": 0,
  "bp": { "locked": true, "price": 9900 },  // locked=true 时 bp_content 不返回
  "is_favorited": false, "is_joined": false
}
```
- BP字段: 未付费解锁时 `bp.locked=true`,不返回 `bp_content`
- 项目方联系信息: 未加入时不返回
- 错误: `BIZ_001` 项目不存在 · `BIZ_002` 项目未审核

### 4.3 项目评价列表 **[v0.2]**
`GET /api/c/project/:id/reviews?page=1`
```json
// Response 200
{ "items": [{ "user_id":2, "nickname":"李四", "authenticity":4, "risk":3, "profitability":5, "created_at":"..." }] }
```

### 4.4 提交项目评价 **[v0.2]**
`POST /api/c/project/:id/reviews`
```json
// Request
{ "authenticity": 4, "risk": 3, "profitability": 5 }  // 各1-5星
// Response 201
{ "review_id": 10 }
```
- 权限: 已加入项目且 joined时长>24h
- 错误: `BIZ_003` 未加入项目不可评价 · `BIZ_004` 加入未满24h · `BIZ_005` 已评价(改用PUT) · `VAL_002` 星级越界

### 4.5 修改评价 **[v0.2]**
`PUT /api/c/project/:id/reviews/:review_id`
```json
// Request
{ "authenticity": 5, "risk": 2, "profitability": 4 }
// Response 200
{ "review_id": 10 }
```

### 4.6 申请发布项目 **[v0.1审核/v0.2支付]**
`POST /api/c/project/apply`
```json
// Request
{ "title": "...", "one_liner": "...", "intro": "...", "category_id": 2, /* 全模板字段 */ }
// Response 201
{ "apply_id": 20, "audit_status": "pending", "order": null }  // v0.1 order=null; v0.2 返回 b_order 待支付
```

---

## 5. C 端 — 合作 `/api/c/coop`

### 5.1 城市运营中心列表 **[v0.3]**
`GET /api/c/coop/city-centers?page=1&region=杭州`
```json
// Response 200
{ "items": [{ "id":1, "city_name":"杭州", "address":"...", "contact_name":"王五", "contact_wechat":null, "contact_phone":null, "activity": {...}, "is_favorited": false }] }
```
- 联系方式: 默认脱敏(null),入圈后可见(见5.2)

### 5.2 申请入圈 **[v0.3]**
`POST /api/c/coop/city-centers/:id/join`
```json
// Response 201
{ "relation_id": 30 }
```
- 错误: `BIZ_020` 已入圈

### 5.3 申请合伙人 **[v0.3]**
`POST /api/c/coop/city-centers/:id/partner-apply`
```json
// Request
{ "name": "...", "phone": "...", "info": "..." }
// Response 201
{ "order_id": 40, "pay_params": {...} }  // c_order.type=partner,微信支付参数
```

### 5.4 收藏运营中心 **[v0.3]**
`POST /api/c/coop/city-centers/:id/favorite`
```json
// Response 201
{ "favorite_id": 50 }
```

### 5.5 转发记录 **[v0.3]**
`POST /api/c/coop/city-centers/:id/forward`
```json
// Request
{ "channel": "wechat_friend" }  // wechat_friend/wechat_moments/copy_link
// Response 201
{ "forward_id": 60 }
```
- 用于转发数统计(B端数据看板)

---

## 6. C 端 — 资源 `/api/c/resource`

### 6.1 资源广场列表 **[v0.3]**
`GET /api/c/resource?page=1&keyword=资金&type=resource&region=杭州`
```json
// Response 200
{ "items": [{
  "user_id": 2, "nickname": "李四", "b_name": "杭州运营中心",
  "type": "resource", "content": "有100万闲置资金寻项目", "visibility": "public"
}] }
```
- 仅返回公开白名单字段(见 [PERMISSION.md §4.1](./PERMISSION.md)): **不含**手机/微信/身份证
- 过滤: 排除被拉黑用户、封禁用户、`hidden` 资源
- 错误: `VAL_001` 分页错误

### 6.2 用户资源详情 **[v0.3]**
`GET /api/c/resource/user/:user_id`
```json
// Response 200
{
  "user_id": 2, "nickname": "李四", "b_name": "杭州运营中心",
  "resources": [{"id":1,"content":"...","visibility":"public"}],
  "demands": [{"id":2,"content":"...","visibility":"public"}],
  "wechat_visible": false,  // 是否已互换可见
  "wechat": null  // wechat_visible=false 时为null
}
```
- 资源仅返回当前用户有权见的(public/b_only且在指定B端内/已互换)
- 错误: `BIZ_030` 用户不存在/已封禁

### 6.3 申请微信互换 **[v0.3]**
`POST /api/c/resource/swap`
```json
// Request
{ "to_user_id": 2 }
// Response 201
{ "swap_id": 70, "status": "pending" }
```
- 对方 swap_setting=auto_approve 时立即 `approved`
- 错误: `BIZ_031` 已申请待处理 · `BIZ_032` 对方已拉黑你

### 6.4 审核互换申请 **[v0.3]**
`PUT /api/c/resource/swap/:swap_id`
```json
// Request
{ "action": "approved" }  // approved/rejected
// Response 200
{ "swap_id": 70, "status": "approved" }
```

### 6.5 拉黑用户 **[v0.3]**
`POST /api/c/resource/block/:user_id`
```json
// Response 201
{ "block_id": 80 }
```

### 6.6 举报用户 **[v0.3]**
`POST /api/c/resource/report/:user_id`
```json
// Request
{ "reason": "虚假资料" }
// Response 201
{ "report_id": 90 }
```

---

## 7. C 端 — 我的 `/api/c/me`

### 7.1 个人资料 **[v0.1]**
`GET /api/c/me`
```json
// Response 200
{
  "user": { "id":1, "phone":"138****8000", "nickname":"...", "avatar":"..." },
  "entry_source": "platform",
  "swap_setting": "manual_review",
  "kyc_status": "approved"  // pending/approved/rejected/null
}
```
- b_only 入口用户: 仅返回认证+下级相关字段,功能范围受限

### 7.2 更新资料 **[v0.1]**
`PUT /api/c/me`
```json
// Request
{ "nickname": "...", "avatar": "...", "swap_setting": "auto_approve" }
// Response 200
{ "user": {...} }
```

### 7.3 我的资源列表 **[v0.3]**
`GET /api/c/me/resources`
```json
// Response 200
{ "items": [{"id":1,"type":"resource","content":"...","visibility":"public","visible_b_id":null}] }
```

### 7.4 新增/更新资源 **[v0.3]**
`POST /api/c/me/resources` · `PUT /api/c/me/resources/:id`
```json
// Request
{ "type": "resource", "content": "...", "visibility": "b_only", "visible_b_id": 12 }
// Response 201
{ "id": 1 }
```
- visibility=b_only 时 visible_b_id 必填
- 错误: `VAL_003` b_only 缺 visible_b_id

### 7.5 实名认证(KYC) **[v0.2]**
`POST /api/c/me/kyc`
```json
// Request
{ "real_name": "张三", "id_card": "330..."}  // 服务端加密存储
// Response 201
{ "kyc_id": 1, "status": "pending" }
```
- 敏感信息 AES 加密,哈希查重
- 错误: `BIZ_040` 已认证 · `BIZ_041` 身份证已被其他账号使用

### 7.6 收藏的项目 **[v0.1]**
`GET /api/c/me/favorites?type=project&page=1`
```json
// Response 200
{ "items": [{ "project_id":1, "title":"...", "favorited_at":"..." }] }
```

### 7.7 收藏/取消项目 **[v0.1]**
`POST /api/c/project/:id/favorite` → 201
`DELETE /api/c/project/:id/favorite` → 204

### 7.8 我加入的项目 **[v0.1]**
`GET /api/c/me/joined?page=1`
```json
// Response 200
{ "items": [{ "project_id":1, "title":"...", "joined_at":"...", "unlock_contact": true }] }
```

### 7.9 我的下级用户 **[v0.1]**
`GET /api/c/me/referrals?page=1`
```json
// Response 200
{ "items": [{ "user_id":2, "nickname":"李四", "joined_at":"...", "joined_count": 3 }] }
```
- 仅一级,按当前 tenant_context.b_id 范围
- 字段见 [PERMISSION.md §3](./PERMISSION.md) 下级用户行

### 7.10 我的佣金 **[v0.2]**
`GET /api/c/me/commissions?page=1&status=pending`
```json
// Response 200
{
  "items": [{ "id":1, "order_id":10, "amount":500, "rate":0.1, "status":"pending", "created_at":"..." }],
  "summary": { "pending": 1500, "settled": 3000, "reversed": 0, "withdrawable": 3000 }
}
```

### 7.11 提现 **[v0.2]**
`POST /api/c/me/withdraw`
```json
// Request
{ "amount": 2000 }  // 分
// Response 201
{ "withdraw_id": 1, "status": "processing" }
```
- 权限: KYC approved
- 限额: 单笔≥1000分,日≤500000分
- 错误: `BIZ_050` 未实名 · `BIZ_051` 余额不足 · `BIZ_052` 超限额 · `PAY_001` 提现失败

### 7.12 升级会员 **[v0.3]**
`POST /api/c/me/upgrade`
```json
// Request
{ "plan": "vip" }
// Response 201
{ "order_id": 60, "pay_params": {...} }
```
> 会员体系细节待 PRD §11 拍板。

### 7.13 B端后台入口 **[v0.1]**
`GET /api/c/me/b-portal`
```json
// Response 200
{ "url": "https://b.smartconnect.com/?token=...", "expires_at": "..." }
```
- 仅 B端用户可见,返回一次性登录链接

---

## 8. C 端 — 支付 `/api/c/pay`

### 8.1 创建订单(下单) **[v0.2]**
`POST /api/c/pay/order`
```json
// Request
{ "type": "bp_unlock", "project_id": 1 }  // bp_unlock/join_project 需 project_id
// Response 201
{ "order_id": 10, "amount": 9900, "pay_params": { "timeStamp":"...", "nonceStr":"...", "package":"...", "signType":"RSA", "paySign":"..." } }
```
- 服务端生成金额,不信任客户端传金额
- 错误: `BIZ_060` 项目不存在 · `BIZ_061` 重复解锁(已付费) · `BIZ_062` 加入设置不匹配 · `VAL_004` type非法

### 8.2 微信支付回调 **[v0.2]**
`POST /api/c/pay/notify/wx`
- 微信服务器→后端,非用户调用
- 校验签名 → 更新 c_order.status `pending→paid` → 触发 `delivered`(发货) → 创建 commission:pending
- 响应微信: `{ "code":"SUCCESS","message":"成功" }`,失败 `FAIL`
- 幂等: 同一 wx_trade_no 重复回调不重复发货

### 8.3 查询订单状态 **[v0.2]**
`GET /api/c/pay/order/:order_id`
```json
// Response 200
{ "order_id":10, "type":"bp_unlock", "amount":9900, "status":"delivered", "paid_at":"...", "delivered_at":"..." }
```

### 8.4 申请退款 **[v0.2]**
`POST /api/c/pay/order/:order_id/refund`
```json
// Request
{ "reason": "..." }  // 仅全额退款,v0.1不支持部分退款
// Response 201
{ "refund_id": 1, "status": "processing" }
```
- 权限: 仅订单本人
- 状态流: c_order `delivered→refunded` → commission `→reversed`
- 错误: `BIZ_070` 订单不可退款(已退款/非delivered) · `PAY_002` 退款失败

---

## 9. B 端后台 — 登录 `/api/b/auth`

### 9.1 B端登录 **[v0.1]**
`POST /api/b/auth/login`
```json
// Request
{ "phone": "13800138000", "password": "..." }
// Response 200
{ "token": "jwt...", "b_tenant": { "id":1, "name":"杭州运营中心", "module_config": {...} } }
```
- 首次登录走一次性初始化链接(见 9.2),非密码
- 错误: `AUTH_003` 账号或密码错误 · `AUTH_004` 账号已禁用

### 9.2 初始化密码(首登) **[v0.1]**
`POST /api/b/auth/init-password`
```json
// Request
{ "init_token": "短信链接token", "password": "..." }
// Response 200
{ "token": "jwt..." }
```
- init_token 一次性,有效期30分钟
- 错误: `AUTH_005` token无效/过期 · `AUTH_006` 已初始化

---

## 10. B 端后台 — 项目 `/api/b/project`

### 10.1 我的项目列表 **[v0.1]**
`GET /api/b/project?page=1&status=approved`
```json
// Response 200
{ "items": [{ "id":1, "title":"...", "audit_status":"approved", "created_at":"...", "join_count": 12 }] }
```

### 10.2 新增项目 **[v0.1]**
`POST /api/b/project`
```json
// Request
{ "title":"...", "one_liner":"...", "category_id":2, "intro":"...", /* 全模板字段 */,
  "join_mode":"paid", "join_price":9900, "bp_price":19900 }
// Response 201
{ "id":1, "audit_status":"pending" }
```
- join_price 受平台 fee_cap 上限约束
- 错误: `BIZ_080` join_price超上限 · `VAL_005` 必填字段缺失

### 10.3 编辑项目 **[v0.1]**
`PUT /api/b/project/:id`
- 同 10.2 字段,Response 200

### 10.4 删除项目 **[v0.1]**
`DELETE /api/b/project/:id` → 204
- 已有付费加入的项目不可删(需先下线)
- 错误: `BIZ_081` 项目有付费记录不可删

### 10.5 项目动态管理 **[v0.2]**
`GET /api/b/project/:id/dynamics` · `POST /api/b/project/:id/dynamics` · `PUT /api/b/dynamics/:dyn_id` · `DELETE /api/b/dynamics/:dyn_id`
```json
// POST Request
{ "title":"...", "content":"..." }
// Response 201
{ "id":1 }
```

### 10.6 加入设置 **[v0.1]**
`PUT /api/b/project/:id/join-setting`
```json
// Request
{ "join_mode":"paid", "join_price":9900 }
// Response 200
{ "join_mode":"paid", "join_price":9900 }
```
- 错误: `BIZ_080` 超上限

---

## 11. B 端后台 — 用户与数据 `/api/b/user`

### 11.1 浏览数据 **[v0.2]**
`GET /api/b/user/views?page=1&project_id=1`
```json
// Response 200
{ "items": [{ "user_id":2, "nickname":"李四", "project_id":1, "view_time":"...", "duration_sec":120, "is_favorited":true, "forward_count":2 }] }
```
- 字段见 [PERMISSION.md §3](./PERMISSION.md) 浏览数据行

### 11.2 加入用户 **[v0.2]**
`GET /api/b/user/joined?page=1&project_id=1`
```json
// Response 200
{ "items": [{ "user_id":2, "nickname":"李四", "project_id":1, "joined_at":"...", "unlock_contact":true, "contact_wechat":"...", "contact_phone":"..." }] }
```
- 加入用户可见项目方联系方式(单向解锁)
- 字段见 [PERMISSION.md §3](./PERMISSION.md) 加入用户行

### 11.3 下级用户 **[v0.1]**
`GET /api/b/user/referrals?page=1`
```json
// Response 200
{ "items": [{ "user_id":2, "nickname":"李四", "joined_at":"...", "recommend_count":5, "joined_count":3 }] }
```
- 字段见 [PERMISSION.md §3](./PERMISSION.md) 下级用户行

### 11.4 用户审核 **[v0.2]**
`PUT /api/b/user/:user_id/audit`
```json
// Request
{ "action":"approved" }  // approved/rejected
// Response 200
{ "user_id":2, "status":"active" }
```

### 11.5 用户详情/编辑 **[v0.2]**
`GET /api/b/user/:user_id` · `PUT /api/b/user/:user_id`
```json
// GET Response 200
{ "user_id":2, "nickname":"...", "phone":"138****8000", "entry_source":"platform", "joined_projects":[...] }
```
- 不可见身份证/其他B端数据

### 11.6 新增/删除用户 **[v0.2]**
`POST /api/b/user` · `DELETE /api/b/user/:user_id`
```json
// POST Request
{ "phone":"...", "nickname":"..." }
// Response 201
{ "user_id":3 }
```

---

## 12. B 端后台 — 财务 `/api/b/finance`

### 12.1 分佣记录 **[v0.2]**
`GET /api/b/finance/commissions?page=1&status=pending`
```json
// Response 200
{ "items": [{ "id":1, "order_id":10, "referrer_id":2, "amount":500, "rate":0.1, "status":"pending", "created_at":"..." }], "summary":{ "total":5000, "settled":3000 } }
```

### 12.2 订单记录 **[v0.2]**
`GET /api/b/finance/orders?page=1&type=join_project`
```json
// Response 200
{ "items": [{ "id":10, "user_id":3, "type":"join_project", "amount":9900, "status":"delivered", "paid_at":"..." }] }
```

### 12.3 数据看板 **[v0.2]**
`GET /api/b/finance/dashboard`
```json
// Response 200
{ "revenue_total": 99000, "revenue_month": 12000, "commission_total": 9900, "join_count": 30, "bp_unlock_count": 15 }
```

---

## 13. 总后台 — B端管理 `/api/admin/b`

### 13.1 B端列表 **[v0.1]**
`GET /api/admin/b?page=1&status=active`
```json
// Response 200
{ "items": [{ "id":1, "phone":"...", "name":"杭州运营中心", "city_center_id":1, "status":"active", "fee_cap":99900, "created_at":"..." }] }
```

### 13.2 新增B端 **[v0.1]**
`POST /api/admin/b`
```json
// Request
{ "phone":"...", "name":"...", "city_center_id":1, "fee_cap":99900, "module_config":{...} }
// Response 201
{ "id":1, "init_token":"..." }  // 返回首登初始化链接token
```

### 13.3 修改/删除B端 **[v0.1]**
`PUT /api/admin/b/:id` · `DELETE /api/admin/b/:id`
```json
// PUT Request
{ "name":"...", "fee_cap":..., "module_config":{...}, "status":"active" }
// Response 200
{ "id":1 }
```
- 删除为软删,有订单的B端不可硬删
- 错误: `BIZ_090` B端有未结算订单

### 13.4 费用上限设置 **[v0.1]**
`PUT /api/admin/b/:id/fee-cap`
```json
// Request
{ "fee_cap": 99900 }
// Response 200
{ "fee_cap": 99900 }
```

### 13.5 生成B端小程序码 **[v0.3]**
`POST /api/admin/b/:id/qrcode`
```json
// Response 201
{ "qrcode_url":"...", "scene":"b=1&sig=...", "link":"..." }
```
- scene 含签名,前端不可伪造(见 [ARCHITECTURE.md §2.2](./ARCHITECTURE.md))

---

## 14. 总后台 — 数据与模块 `/api/admin`

### 14.1 全局数据看板 **[v0.1]**
`GET /api/admin/data/dashboard`
```json
// Response 200
{ "b_count":50, "c_count":12000, "project_count":300, "revenue_total":500000, "revenue_month":50000 }
```

### 14.2 B端/C端用户数据 **[v0.2]**
`GET /api/admin/data/b-tenants?page=1` · `GET /api/admin/data/c-users?page=1`
```json
// c-users Response 200
{ "items": [{ "user_id":2, "phone":"138****8000", "status":"active", "joined_b_count":2, "created_at":"..." }] }
```
- 平台管理员可见脱敏手机,身份证仅风控模块

### 14.3 财务:订单与分佣 **[v0.2]**
`GET /api/admin/data/orders?page=1` · `GET /api/admin/data/commissions?page=1`
- 全平台范围,跨B端

### 14.4 模块管理 **[v0.3]**
`GET /api/admin/module` · `PUT /api/admin/module/:b_id`
```json
// GET Response 200
{ "modules": [{ "b_id":1, "config":{ "project":true, "finance":true, "user":true, "dynamic":false } }] }
// PUT Request
{ "config":{ "project":true, "finance":true, "user":true, "dynamic":true } }
// Response 200
{ "b_id":1, "config":{...} }
```
- 控制 B端后台各模块开关

### 14.5 专家分析发布 **[v0.2]**
`POST /api/admin/expert-analysis`
```json
// Request
{ "project_id":1, "content":"富文本..." }
// Response 201
{ "id":1 }
```
- 平台产出,关联项目

### 14.6 项目审核 **[v0.1]**
`PUT /api/admin/project/:id/audit`
```json
// Request
{ "action":"approved", "score":{ "authenticity":80, "risk":30, "profitability":70 } }  // approved 时可打初始分
// Response 200
{ "project_id":1, "audit_status":"approved" }
```

---

## 15. 错误码总表

| 码 | HTTP | 含义 |
|---|---|---|
| `AUTH_001` | 401 | 微信code无效 |
| `AUTH_002` | 422 | 短信码错误 |
| `AUTH_003` | 401 | B端账号或密码错误 |
| `AUTH_004` | 403 | B端账号已禁用 |
| `AUTH_005` | 401 | 初始化token无效/过期 |
| `AUTH_006` | 409 | 密码已初始化 |
| `TENANT_001` | 403 | scene签名无效 |
| `TENANT_002` | 403 | 租户越权(RLS拦截) |
| `VAL_001` | 400 | 分页参数错误 |
| `VAL_002` | 400 | 星级越界(1-5) |
| `VAL_003` | 400 | b_only 缺 visible_b_id |
| `VAL_004` | 400 | 订单type非法 |
| `VAL_005` | 400 | 必填字段缺失 |
| `BIZ_001` | 404 | 项目不存在 |
| `BIZ_002` | 403 | 项目未审核 |
| `BIZ_003` | 422 | 未加入项目不可评价 |
| `BIZ_004` | 422 | 加入未满24h |
| `BIZ_005` | 409 | 已评价该项目 |
| `BIZ_010` | 409 | 手机号已绑定其他账号 |
| `BIZ_020` | 409 | 已入圈 |
| `BIZ_030` | 404 | 用户不存在/已封禁 |
| `BIZ_031` | 409 | 互换申请已待处理 |
| `BIZ_032` | 403 | 对方已拉黑你 |
| `BIZ_040` | 409 | 已实名认证 |
| `BIZ_041` | 409 | 身份证已被使用 |
| `BIZ_050` | 422 | 未实名不可提现 |
| `BIZ_051` | 422 | 余额不足 |
| `BIZ_052` | 422 | 超提现限额 |
| `BIZ_060` | 404 | 项目不存在(支付) |
| `BIZ_061` | 409 | 重复解锁(已付费) |
| `BIZ_062` | 422 | 加入设置不匹配 |
| `BIZ_070` | 422 | 订单不可退款 |
| `BIZ_080` | 422 | join_price超上限 |
| `BIZ_081` | 409 | 项目有付费记录不可删 |
| `BIZ_090` | 409 | B端有未结算订单不可删 |
| `PAY_001` | 500 | 提现失败 |
| `PAY_002` | 500 | 退款失败 |
| `RATE_001` | 429 | 请求过于频繁 |

---

## 16. 限流策略

| 端点 | 限流 |
|---|---|
| 登录/短信 | 10次/分钟/IP |
| 公开项目列表/详情 | 60次/分钟/IP |
| 评价/互换申请 | 10次/分钟/用户 |
| 提现 | 5次/小时/用户 |
| 其他已认证 | 120次/分钟/用户 |

超限返回 `RATE_001` + `Retry-After` 头。

---

## 17. 待确认

- 会员升级体系(plan 字段值)待 PRD §11
- 部分退款是否开放(v0.1 仅全额)
- 退款规则(限时?条件?)待业务定
- 提现限额数值(单笔/日)待风控定
- WebSocket/SSE 是否需要(实时浏览数据)
