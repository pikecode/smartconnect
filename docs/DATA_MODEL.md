# 慧对接 SmartConnect — 数据模型文档

> 版本: v1.0  ·  日期: 2026-07-01  ·  状态: 草案
> 对应: [PRD.md](./PRD.md)  ·  [ARCHITECTURE.md](./ARCHITECTURE.md)  ·  [PERMISSION.md](./PERMISSION.md)

本文档集中定义数据表、字段、状态机。架构与权限细节见对应文档。

---

## 1. 表分类

| 类别 | 是否带 b_id | RLS | 说明 |
|---|---|---|---|
| 租户表 | ✓ | 启用 b_id RLS | 按B端隔离: project/order/dynamic/user_join/user_favorite/user_referral/city_center |
| 全局表 | ✗ | 不启用 | 全局身份/字典: c_user/category/platform_admin,字段权限控制 |
| 关系表 | ✓(b_id为关系维度) | 启用 b_id RLS | 用户与B端关系: user_tenant_relation(用户↔B端映射) |
| 敏感表 | ✗ | 不启用 | user_kyc,字段加密,模块级访问 |

> 说明: `user_tenant_relation` 带 b_id 是因为它是"用户与某B端的关系"记录,按B端隔离;`user_resource` 带可选 `visible_b_id`(见§3.4)用于"仅某B端可见"场景,但资源本身是全局的,主体不带 b_id。

---

## 2. 租户层表

### 2.1 b_tenant (B端租户)
```sql
id              PK
phone           账号(手机号) 全局唯一
password_hash   bcrypt
name            B端名称
city_center_id  FK → city_center
status          active / disabled
fee_cap         加入费用上限(平台设定,分)
module_config   JSON  功能模块开关
created_at
```

### 2.2 project (项目)
```sql
id              PK
b_id            FK → b_tenant  (租户隔离,RLS)
category_id     FK → category
title
one_liner       一句话介绍
intro           项目简介
vision          愿景
goals           发展及目标
team            团队
technology      技术栈
competition     市场竞争
requirements    项目需求
swot            JSON  SWOT
company_info    JSON  成立/注册资金/经营范围
qcc_url         企查查链接(手动填,白名单校验)
founder_intro   创始人介绍
origin_story    项目发心
bp_content      商业计划书(付费解锁,富文本+PDF)
bp_price        BP解锁价格(分)
join_price      加入价格(分,0=免费)
join_mode       free / paid
audit_status    pending / approved / rejected
created_at
```

### 2.3 project_score (项目评分)
```sql
id              PK
project_id      FK → project
authenticity    真实性分(0-100,越高越好)
risk            风险性分(0-100,越高越危险)
profitability   盈利性分(0-100,越高越好)
review_count    用户评价数(用于最小样本保护)
initial_source  platform / user_aggregate
updated_at
```

### 2.4 project_expert_analysis (专家分析,平台产出)
```sql
id              PK
project_id      FK → project
content         富文本分析
created_at
```

### 2.5 project_dynamic (项目动态)
```sql
id              PK
project_id      FK → project
b_id            FK → b_tenant
content
created_at
```

### 2.6 city_center (城市运营中心)
```sql
id              PK
b_id            FK → b_tenant
city_name       如"杭州"
address
contact_name
contact_wechat
contact_phone
activity        JSON  运营中心活动
created_at
```

### 2.7 user_join (加入项目记录)
```sql
id              PK
user_id         FK → c_user
b_id            FK → b_tenant
project_id      FK → project
joined_at
unlock_contact  boolean  是否已解锁项目方联系方式
```

### 2.8 user_favorite (收藏)
```sql
id              PK
user_id         FK → c_user
b_id            FK → b_tenant
target_type     project / city_center
target_id
created_at
```

### 2.9 user_referral (推荐关系,一级,限定B端内)
```sql
id              PK
b_id            FK → b_tenant
referrer_id     FK → c_user  (上级)
referred_id     FK → c_user  (下级)
created_at
UNIQUE(referred_id, b_id)  每用户每B端仅一个上级
```

### 2.10 b_order (B端服务订单)
> B端向平台购买服务(如发布项目费、增容费)。**不含合伙人**(合伙人属C端申请,见 c_order)。

```sql
id              PK
b_id            FK → b_tenant
type            publish (发布项目) / service (其他B端服务)
amount          分
status          见 §4 订单状态机
wx_trade_no
created_at
paid_at
closed_at
```

### 2.11 c_order (C端订单)
> C端付费: BP解锁、加入项目、申请合伙人。`partner` 类型表示C端申请成为某城市运营中心合伙人。

```sql
id              PK
user_id         FK → c_user
b_id            FK → b_tenant (partner=申请加入的运营中心;bp_unlock/join=项目所属B端)
project_id      FK (partner/b_order无关时为null;bp_unlock/join必填)
type            bp_unlock / join_project / partner
amount          分
status          见 §4 订单状态机
wx_trade_no
refund_amount   已退款金额(分)
created_at
paid_at
delivered_at
closed_at
```

> **partner 归属澄清**: 合伙人是 C 端行为(C端用户申请加入城市运营中心),归 `c_order.type=partner`。`b_order` 仅 B 端购买平台服务,二者不混,避免财务歧义。

### 2.12 commission (分佣记录)
```sql
id              PK
order_id        FK → c_order
referrer_id     FK → c_user  (获佣人)
b_id            FK → b_tenant
amount          分佣金额(分)
rate            分佣比例
status          见 §5 佣金状态机
settle_batch    结算批次号(可空)
created_at
settled_at
```

---

## 3. 全局与关系表

> 本节混合两类: **全局表**(c_user/user_resource 等,不带 b_id,不启用 RLS)与 **关系表**(user_tenant_relation/user_tenant_event,带 b_id,启用 RLS)。各表字段已标注是否带 b_id,实现时按 §1 分类处理。

### 3.1 c_user (C端全局身份,不含敏感信息)
```sql
id              PK
phone           全局唯一
openid          微信openid
unionid
status          active / frozen
created_at
```

### 3.2 user_kyc (实名认证,敏感加密)
> 仅提现/风控模块可访问,普通查询不返回。

```sql
id              PK
user_id         FK → c_user  (1:1)
real_name       AES加密
id_card_hash    身份证号哈希(查重/校验,不可逆)
id_card_enc     身份证号密文(AES,仅风控解密)
verified        pending / approved / rejected
verified_at
created_at
```

### 3.3 user_tenant_relation (用户-B端关系,当前态)
> 表达"用户与某B端的当前关系位",用 flags 多值标记并存状态,避免单值覆盖历史。

```sql
id              PK
user_id         FK → c_user
b_id            FK → b_tenant
relation_flags  位掩码: 1=primary(首次入口) 2=visited(浏览过) 4=joined(加入过)
entry_source    platform / b_only
parent_user_id  该B端内推荐上级(可空)
swap_setting    auto_approve / manual_review
created_at
updated_at
UNIQUE(user_id, b_id)
```

### 3.3a user_tenant_event (用户-B端事件流水,历史)
> 不可变事件流,用于审计/分析/溯源。每次状态变化追加一条。

```sql
id              PK
user_id         FK → c_user
b_id            FK → b_tenant
event_type      primary_entry / visit / join / leave
occurred_at
```

> **设计理由**: relation 为当前态(快查),event 为历史流(审计)。两者职责分离(SOLID),避免单表 relation_type 单值覆盖历史状态(DRY反例)。

### 3.4 user_resource (资源/需求)
```sql
id              PK
user_id         FK → c_user
type            resource / demand
content
visibility      public / b_only / hidden
visible_b_id    FK → b_tenant (nullable; visibility=b_only 时必填,其余为null)
created_at
```

> `visible_b_id` 仅在 `visibility=b_only` 时使用,表示"仅在该B端内可见"。校验层强制非空。

### 3.5 user_score_review (项目评价)
```sql
id              PK
user_id         FK → c_user
project_id      FK → project
b_id            FK → b_tenant
authenticity    1-5星
risk            1-5星
profitability   1-5星
created_at
UNIQUE(user_id, project_id)  每用户每项目一条
```

### 3.6 wechat_swap (微信互换)
```sql
id              PK
from_user_id    FK → c_user
to_user_id      FK → c_user
status          pending / approved / rejected
created_at
```

### 3.7 user_block (拉黑)
```sql
id              PK
user_id         FK → c_user  (拉黑发起者)
blocked_user_id FK → c_user
created_at
UNIQUE(user_id, blocked_user_id)
```

### 3.8 user_report (举报)
```sql
id              PK
reporter_id     FK → c_user
target_user_id  FK → c_user
reason
status          pending / handled / dismissed
created_at
```

### 3.9 category (项目类别字典)
```sql
id              PK
name            AI / 直播 / 电商 / 餐饮 / 教育 / 健康 / 实体连锁 / 区块链 / 其他
sort
```

### 3.10 platform_admin (平台管理员)
```sql
id              PK
username
password_hash
role            super / operator
created_at
```

---

## 4. 订单状态机

### 4.1 状态定义
`created` `pending` `paid` `delivered` `closed` `refunded` `partial_refunded`

### 4.2 合法转换
```
created → pending
pending → paid            (支付成功)
pending → closed          (超时未支付/手动关闭,仅未支付可关闭)
paid → delivered          (发货:解锁BP/联系信息/加入记录)
delivered → refunded       (全额退款,冲正佣金)
delivered → partial_refunded  (部分退款)
```

### 4.3 禁止转换
- `paid` / `delivered` / `refunded` **不可** → `closed`(已支付订单只能退款或履约)
- `closed` 为终态,不可恢复

---

## 5. 佣金状态机

### 5.1 状态定义
`pending` `frozen` `settled` `reversed`

### 5.2 合法转换
```
(订单 delivered 时立即创建 commission: pending)
pending → frozen     (风控:异常订单/申诉中)
pending → settled    (T+1风控期通过,可提现)
frozen → settled     (申诉通过,解冻)
frozen → reversed    (申诉失败,冲正)
settled → reversed   (订单退款,扣回已结佣金)
```

### 5.3 时序约定
- `commission` 在订单 `delivered` 时**立即创建为 pending**,不等风控期
- T+1 风控期通过后 `pending → settled`
- 退款触发冲正,与订单状态机联动

---

## 6. 互换状态机

```
pending → approved   (对方同意/自动同意)
pending → rejected   (对方拒绝)
approved 为终态(双方互见微信)
rejected 可重新申请
```

---

## 7. 数据字典

### 7.1 订单类型
- c_order.type: `bp_unlock` `join_project` `partner`(C端申请合伙人)
- b_order.type: `publish` `service`(B端购买平台服务)

### 7.2 用户-B端关系位掩码(relation_flags)
`1=primary`(首次入口) `2=visited`(浏览过) `4=joined`(加入过) — 多值并存,可叠加
### 7.3 入口来源
`platform` `b_only`

### 7.4 互换设置
`auto_approve` `manual_review`

### 7.5 资源可见性
`public` `b_only` `hidden`(b_only 时 visible_b_id 必填)

### 7.6 KYC状态
`pending` `approved` `rejected`
