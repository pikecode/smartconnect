-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('platform', 'b_only');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "JoinMode" AS ENUM ('free', 'paid');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'frozen');

-- CreateEnum
CREATE TYPE "SwapSetting" AS ENUM ('auto_approve', 'manual_review');

-- CreateEnum
CREATE TYPE "BTenantStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super', 'operator');

-- CreateTable
CREATE TABLE "platform_admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'operator',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b_tenant" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city_center_id" INTEGER,
    "status" "BTenantStatus" NOT NULL DEFAULT 'active',
    "fee_cap" INTEGER NOT NULL DEFAULT 99900,
    "module_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_center" (
    "id" SERIAL NOT NULL,
    "b_id" INTEGER NOT NULL,
    "city_name" TEXT NOT NULL,
    "address" TEXT,
    "contact_name" TEXT,
    "contact_wechat" TEXT,
    "contact_phone" TEXT,
    "activity" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "b_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "one_liner" TEXT NOT NULL,
    "intro" TEXT,
    "vision" TEXT,
    "goals" TEXT,
    "team" TEXT,
    "technology" TEXT,
    "competition" TEXT,
    "requirements" TEXT,
    "swot" JSONB,
    "company_info" JSONB,
    "qcc_url" TEXT,
    "founder_intro" TEXT,
    "origin_story" TEXT,
    "bp_content" TEXT,
    "bp_price" INTEGER NOT NULL DEFAULT 0,
    "join_price" INTEGER NOT NULL DEFAULT 0,
    "join_mode" "JoinMode" NOT NULL DEFAULT 'free',
    "joinRequirement" TEXT,
    "audit_status" "AuditStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_score" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "authenticity" INTEGER NOT NULL DEFAULT 50,
    "risk" INTEGER NOT NULL DEFAULT 50,
    "profitability" INTEGER NOT NULL DEFAULT 50,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "initial_source" TEXT NOT NULL DEFAULT 'platform',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_expert_analysis" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_expert_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_dynamic" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_dynamic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "c_user" (
    "id" SERIAL NOT NULL,
    "phone" TEXT,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "c_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tenant_relation" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "relation_flags" INTEGER NOT NULL DEFAULT 1,
    "entry_source" "EntrySource" NOT NULL,
    "parent_user_id" INTEGER,
    "swap_setting" "SwapSetting" NOT NULL DEFAULT 'manual_review',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tenant_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_resource" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "visible_b_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_join" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlock_contact" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_join_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_referral" (
    "id" SERIAL NOT NULL,
    "b_id" INTEGER NOT NULL,
    "referrer_id" INTEGER NOT NULL,
    "referred_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_score_review" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "authenticity" INTEGER NOT NULL,
    "risk" INTEGER NOT NULL,
    "profitability" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_score_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "c_order" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "b_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "wx_trade_no" TEXT,
    "refund_amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "c_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b_order" (
    "id" SERIAL NOT NULL,
    "b_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "wx_trade_no" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "b_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b_init_token" (
    "id" SERIAL NOT NULL,
    "b_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b_init_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_username_key" ON "platform_admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "b_tenant_phone_key" ON "b_tenant"("phone");

-- CreateIndex
CREATE INDEX "project_b_id_category_id_idx" ON "project"("b_id", "category_id");

-- CreateIndex
CREATE INDEX "project_audit_status_idx" ON "project"("audit_status");

-- CreateIndex
CREATE UNIQUE INDEX "project_score_project_id_key" ON "project_score"("project_id");

-- CreateIndex
CREATE INDEX "project_score_b_id_idx" ON "project_score"("b_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_expert_analysis_project_id_key" ON "project_expert_analysis"("project_id");

-- CreateIndex
CREATE INDEX "project_expert_analysis_b_id_idx" ON "project_expert_analysis"("b_id");

-- CreateIndex
CREATE INDEX "project_dynamic_b_id_idx" ON "project_dynamic"("b_id");

-- CreateIndex
CREATE UNIQUE INDEX "c_user_phone_key" ON "c_user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "c_user_openid_key" ON "c_user"("openid");

-- CreateIndex
CREATE INDEX "user_tenant_relation_b_id_idx" ON "user_tenant_relation"("b_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenant_relation_user_id_b_id_key" ON "user_tenant_relation"("user_id", "b_id");

-- CreateIndex
CREATE INDEX "user_resource_user_id_idx" ON "user_resource"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_user_id_target_type_target_id_key" ON "user_favorite"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_join_b_id_project_id_idx" ON "user_join"("b_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_join_user_id_project_id_key" ON "user_join"("user_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_referral_referred_id_b_id_key" ON "user_referral"("referred_id", "b_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_score_review_user_id_project_id_key" ON "user_score_review"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "c_order_b_id_status_idx" ON "c_order"("b_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "b_init_token_token_hash_key" ON "b_init_token"("token_hash");

-- CreateIndex
CREATE INDEX "b_init_token_b_id_idx" ON "b_init_token"("b_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_score" ADD CONSTRAINT "project_score_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_expert_analysis" ADD CONSTRAINT "project_expert_analysis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_dynamic" ADD CONSTRAINT "project_dynamic_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_dynamic" ADD CONSTRAINT "project_dynamic_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_relation" ADD CONSTRAINT "user_tenant_relation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_relation" ADD CONSTRAINT "user_tenant_relation_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_resource" ADD CONSTRAINT "user_resource_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_join" ADD CONSTRAINT "user_join_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_join" ADD CONSTRAINT "user_join_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_join" ADD CONSTRAINT "user_join_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_referral" ADD CONSTRAINT "user_referral_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_referral" ADD CONSTRAINT "user_referral_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_referral" ADD CONSTRAINT "user_referral_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_score_review" ADD CONSTRAINT "user_score_review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_score_review" ADD CONSTRAINT "user_score_review_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "c_order" ADD CONSTRAINT "c_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "c_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "c_order" ADD CONSTRAINT "c_order_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b_order" ADD CONSTRAINT "b_order_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b_init_token" ADD CONSTRAINT "b_init_token_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "b_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
