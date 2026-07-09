#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── 颜色 ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[!]${NC}   $*"; }

# ── 1. 检查依赖 ──────────────────────────────────────────
command -v docker  >/dev/null || { warn "需要 Docker"; exit 1; }
command -v pnpm    >/dev/null || { warn "需要 pnpm"; exit 1; }

# ── 1b. 确保 Docker daemon 在运行 ────────────────────────
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon 未运行，尝试启动 Docker Desktop…"
  if [ "$(uname)" = "Darwin" ]; then
    open -a Docker
    info "等待 Docker Desktop 启动（最多 60 秒）…"
    for i in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 1
      printf "."
    done
    echo ""
    docker info >/dev/null 2>&1 || { warn "Docker 启动失败，请手动打开 Docker Desktop 后重试"; exit 1; }
    ok "Docker Desktop 已就绪"
  else
    warn "请手动启动 Docker daemon 后重试"; exit 1
  fi
fi

# ── 2. 复制 .env（首次）─────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  ok ".env 已从 .env.example 生成，如需修改请编辑后重新运行"
fi

# ── 3. 启动 DB + Redis ───────────────────────────────────
info "启动 Docker 服务(postgres + redis)…"
docker compose up -d
info "等待 PostgreSQL 就绪…"
until docker compose exec -T postgres pg_isready -U smartconnect -q 2>/dev/null; do
  sleep 1
done
ok "PostgreSQL 就绪"

# ── 4. 安装依赖（增量） ──────────────────────────────────
info "检查 pnpm 依赖…"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── 5. Prisma migrate + seed ─────────────────────────────
info "运行 Prisma 迁移…"
cd server
# Prisma CLI 在 server/ 目录下找 .env，链接根目录 .env
[ -f ../.env ] && [ ! -f .env ] && ln -s ../.env .env && info "已链接 .env 到 server/"
FIRST_MIGRATE=false
if ! npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  npx prisma migrate dev --name init
  FIRST_MIGRATE=true
fi
npx prisma generate

if [ "$FIRST_MIGRATE" = true ]; then
  info "填充种子数据…"
  npx prisma db seed
  ok "种子数据已写入"
fi
cd "$ROOT"

# ── 6. 启动后端 (:13000) ──────────────────────────────────
info "启动后端服务…"
mkdir -p logs
pnpm dev:server > logs/server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > logs/server.pid

# 等后端就绪
info "等待后端就绪…"
for i in $(seq 1 30); do
  if curl -sf http://localhost:13000/api/health >/dev/null 2>&1; then
    ok "后端已就绪 http://localhost:13000"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    warn "后端启动超时，查看日志: tail -f logs/server.log"
  fi
done

# ── 7. 启动 B端/总后台 Web (:15173) ───────────────────────
info "启动前端管理后台…"
pnpm dev:web > logs/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > logs/web.pid
sleep 2

# ── 8. 完成提示 ───────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  慧对接 SmartConnect 已启动${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  API      ${CYAN}http://localhost:13000/api${NC}"
echo -e "  健康检查  ${CYAN}http://localhost:13000/api/health${NC}"
echo -e "  管理后台  ${CYAN}http://localhost:15173${NC}  (B端/总后台)"
echo ""
echo -e "  测试账号 B端:     13800000001 / huiduijie"
echo -e "  测试账号 总后台:  admin / huiduijie"
echo ""
echo -e "  小程序: 在微信开发者工具导入 ${CYAN}miniapp/${NC} 目录"
echo -e "         API 已配置 http://localhost:13000/api"
echo ""
echo -e "  日志:  tail -f logs/server.log"
echo -e "         tail -f logs/web.log"
echo ""
echo -e "  停止:  ${YELLOW}./stop.sh${NC}"
echo ""

# ── 9. 保持前台 (Ctrl+C 退出) ────────────────────────────
wait
