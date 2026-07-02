-- RLS 策略迁移 (手动执行,Prisma不管理RLS)
-- 对齐 docs/ARCHITECTURE.md §2.1 与 docs/PERMISSION.md §7
--
-- 租户表(带 b_id)启用 RLS: project, project_score, project_expert_analysis,
--   project_dynamic, city_center, user_tenant_relation, user_favorite,
--   user_join, user_referral, user_score_review, c_order, b_order
--
-- 平台级表不启用 b_id RLS: c_user, user_resource, category, platform_admin

-- 先删已有策略(幂等)
DO $$
DECLARE
  t text;
  p text;
  tenant_tables text[] := ARRAY[
    'project','project_score','project_expert_analysis','project_dynamic',
    'city_center','user_tenant_relation','user_favorite','user_join',
    'user_referral','user_score_review','c_order','b_order'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- 删除旧策略(若存在)
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
    END LOOP;
  END LOOP;
END $$;

-- 租户表: 启用 RLS + 策略
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'project','project_score','project_expert_analysis','project_dynamic',
    'city_center','user_tenant_relation','user_favorite','user_join',
    'user_referral','user_score_review','c_order','b_order'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    -- 策略: b_id 必须等于当前会话变量; null b_id 不匹配(租户隔离)
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (b_id = NULLIF(current_setting('app.b_id', true), '')::bigint)
    $f$, t);
  END LOOP;
END $$;

-- 平台公开查询豁免: project 表对 approved 项目允许 b_id=null(平台入口)查询
-- 当 app.b_id 未设置时, 允许查 approved 项目
DROP POLICY IF EXISTS platform_public ON project;
CREATE POLICY platform_public ON project
  FOR SELECT
  USING (
    (NULLIF(current_setting('app.b_id', true), '') IS NULL AND audit_status = 'approved')
    OR
    (b_id = NULLIF(current_setting('app.b_id', true), '')::bigint)
  );

-- project_score/project_expert_analysis: 通过 project 表 EXISTS 子查询豁免
DROP POLICY IF EXISTS platform_public_score ON project_score;
CREATE POLICY platform_public_score ON project_score
  FOR SELECT
  USING (
    (NULLIF(current_setting('app.b_id', true), '') IS NULL
     AND EXISTS (SELECT 1 FROM project p WHERE p.id = project_id AND p.audit_status = 'approved'))
    OR
    (b_id = NULLIF(current_setting('app.b_id', true), '')::bigint)
  );

DROP POLICY IF EXISTS platform_public_analysis ON project_expert_analysis;
CREATE POLICY platform_public_analysis ON project_expert_analysis
  FOR SELECT
  USING (
    (NULLIF(current_setting('app.b_id', true), '') IS NULL
     AND EXISTS (SELECT 1 FROM project p WHERE p.id = project_id AND p.audit_status = 'approved'))
    OR
    (b_id = NULLIF(current_setting('app.b_id', true), '')::bigint)
  );

-- project_dynamic: B端入口时按 b_id 隔离, 平台入口时不设置 b_id 则按 approved 项目豁免
DROP POLICY IF EXISTS platform_public_dynamic ON project_dynamic;
CREATE POLICY platform_public_dynamic ON project_dynamic
  FOR SELECT
  USING (
    (NULLIF(current_setting('app.b_id', true), '') IS NULL
     AND EXISTS (SELECT 1 FROM project p WHERE p.id = project_id AND p.audit_status = 'approved'))
    OR
    (b_id = NULLIF(current_setting('app.b_id', true), '')::bigint)
  );
