#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/auto-parts-crm}"
REPO_URL="${REPO_URL:-https://github.com/arvind10799/autopartscrm.git}"
BRANCH="${BRANCH:-main}"
APP_PUBLIC_URL="${APP_PUBLIC_URL:-}"
API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:3000}"
DATABASE_URL="${DATABASE_URL:-}"
JWT_SECRET="${JWT_SECRET:-}"
JWT_EXPIRES_IN_SECONDS="${JWT_EXPIRES_IN_SECONDS:-86400}"
SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-}"
REDIS_HOST="${REDIS_HOST:-crm-wjf4r8.serverless.apse2.cache.amazonaws.com}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_USERNAME="${REDIS_USERNAME:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DB="${REDIS_DB:-0}"
REDIS_CACHE_ENABLED="${REDIS_CACHE_ENABLED:-true}"
REDIS_CACHE_KEY_PREFIX="${REDIS_CACHE_KEY_PREFIX:-auto-parts-crm:cache:}"
REDIS_TLS_ENABLED="${REDIS_TLS_ENABLED:-true}"
REDIS_CONNECT_TIMEOUT_MS="${REDIS_CONNECT_TIMEOUT_MS:-5000}"
ORDERS_CACHE_TTL_SECONDS="${ORDERS_CACHE_TTL_SECONDS:-60}"
BULLMQ_PREFIX="${BULLMQ_PREFIX:-auto-parts-crm}"
APP_BASE_URL="${APP_BASE_URL:-${APP_PUBLIC_URL}}"
INVOICE_SIGNING_TOKEN_TTL_DAYS="${INVOICE_SIGNING_TOKEN_TTL_DAYS:-30}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
MAIL_FROM="${MAIL_FROM:-MEE Auto Parts Billing <billing@meeautoparts.com>}"

require_value() {
  local name="$1"
  local value="$2"

  if [[ -z "${value}" ]]; then
    echo "Missing required environment variable: ${name}"
    exit 1
  fi
}

require_value "APP_PUBLIC_URL" "${APP_PUBLIC_URL}"
require_value "DATABASE_URL" "${DATABASE_URL}"
require_value "JWT_SECRET" "${JWT_SECRET}"
require_value "SEED_USER_PASSWORD" "${SEED_USER_PASSWORD}"

ensure_database_exists() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql is required to create or verify the PostgreSQL database."
    exit 1
  fi

  local db_info
  db_info="$(
    DATABASE_URL="${DATABASE_URL}" node <<'NODE'
const url = new URL(process.env.DATABASE_URL);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const host = url.hostname;
const port = url.port || '5432';
const sslMode = url.searchParams.get('sslmode') || 'prefer';
console.log([host, port, user, password, dbName, sslMode].join('\t'));
NODE
  )"

  IFS=$'\t' read -r db_host db_port db_user db_password db_name db_sslmode <<< "${db_info}"

  if [[ -z "${db_name}" ]]; then
    echo "DATABASE_URL must include a database name."
    exit 1
  fi

  if PGPASSWORD="${db_password}" psql "host=${db_host} port=${db_port} user=${db_user} dbname=${db_name} sslmode=${db_sslmode}" -c "select 1" >/dev/null 2>&1; then
    return
  fi

  echo "Creating PostgreSQL database ${db_name}."
  PGPASSWORD="${db_password}" psql "host=${db_host} port=${db_port} user=${db_user} dbname=postgres sslmode=${db_sslmode}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db_name}\";"
}

if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo mkdir -p "${APP_DIR}"
  sudo chown "${USER}:${USER}" "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

cat > backend/.env <<EOF
DATABASE_URL="${DATABASE_URL}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN_SECONDS=${JWT_EXPIRES_IN_SECONDS}
SEED_USER_PASSWORD="${SEED_USER_PASSWORD}"
REDIS_HOST="${REDIS_HOST}"
REDIS_PORT=${REDIS_PORT}
REDIS_USERNAME="${REDIS_USERNAME}"
REDIS_PASSWORD="${REDIS_PASSWORD}"
REDIS_DB=${REDIS_DB}
REDIS_CACHE_ENABLED=${REDIS_CACHE_ENABLED}
REDIS_CACHE_KEY_PREFIX="${REDIS_CACHE_KEY_PREFIX}"
REDIS_TLS_ENABLED=${REDIS_TLS_ENABLED}
REDIS_CONNECT_TIMEOUT_MS=${REDIS_CONNECT_TIMEOUT_MS}
ORDERS_CACHE_TTL_SECONDS=${ORDERS_CACHE_TTL_SECONDS}
BULLMQ_PREFIX="${BULLMQ_PREFIX}"
APP_BASE_URL="${APP_BASE_URL}"
INVOICE_SIGNING_TOKEN_TTL_DAYS=${INVOICE_SIGNING_TOKEN_TTL_DAYS}
SMTP_HOST="${SMTP_HOST}"
SMTP_PORT=${SMTP_PORT}
SMTP_USER="${SMTP_USER}"
SMTP_PASS="${SMTP_PASS}"
MAIL_FROM="${MAIL_FROM}"
PORT=3000
EOF

cat > frontend/.env.production <<EOF
NEXT_PUBLIC_APP_NAME="Auto Parts CRM"
NEXT_PUBLIC_APP_URL="${APP_PUBLIC_URL}"
NEXT_PUBLIC_API_TIMEOUT_MS=10000
NEXT_PUBLIC_TOAST_DURATION_MS=5000
BACKEND_API_URL="${API_INTERNAL_URL}"
BACKEND_API_TIMEOUT_MS=10000
AUTH_COOKIE_MAX_AGE_SECONDS=86400
AUTH_COOKIE_SECURE=$([[ "${APP_PUBLIC_URL}" == https://* ]] && echo true || echo false)
EOF

if [[ ! -f backend/node_modules/.package-lock.json ]]; then
  npm ci --prefix backend
fi

if [[ ! -f frontend/node_modules/.package-lock.json ]]; then
  npm ci --prefix frontend
fi

ensure_database_exists
npm run prisma:generate --prefix backend
(cd backend && npx prisma migrate deploy)
(cd backend && npm run prisma:seed)

npm run build --prefix backend
npm run build --prefix frontend

pm2 delete auto-parts-backend >/dev/null 2>&1 || true
pm2 delete auto-parts-worker >/dev/null 2>&1 || true
pm2 delete auto-parts-frontend >/dev/null 2>&1 || true

pm2 start "npm run start:prod --prefix backend" --name auto-parts-backend
pm2 start "npm run start:worker --prefix backend" --name auto-parts-worker
pm2 start "npm run start --prefix frontend" --name auto-parts-frontend
pm2 save
sudo env PATH="${PATH}" pm2 startup systemd -u "${USER}" --hp "${HOME}" >/dev/null

sudo tee /etc/nginx/conf.d/auto-parts-crm.conf >/dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

pm2 status
echo "Deployment complete: ${APP_PUBLIC_URL}"
