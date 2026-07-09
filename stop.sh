#!/usr/bin/env bash
# 停止所有本地开发服务

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

stop_pid() {
  local file="$1" name="$2"
  if [ -f "$file" ]; then
    local pid; pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" && echo -e "${GREEN}[ok]${NC}  $name 已停止 (PID $pid)"
    fi
    rm -f "$file"
  fi
}

stop_pid logs/server.pid "后端"
stop_pid logs/web.pid   "前端"

echo -e "${CYAN}[dev]${NC} 停止 Docker 服务…"
docker compose stop

echo ""
echo "所有服务已停止。再次启动: ./dev.sh"
