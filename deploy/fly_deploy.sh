#!/bin/bash
# ============================================================
# Network Capital — Fly.io deploy helper.
# Usage:
#   ATLAS_PASSWORD='<real password>' bash /app/deploy/fly_deploy.sh
# Requires FLY_API_TOKEN in env (source /tmp/flyenv.sh first).
# Reads app secrets from /app/backend/.env and pushes them as Fly
# secrets (staged), then runs a remote build + deploy.
# ============================================================
set -euo pipefail
export FLYCTL_INSTALL="/root/.fly"; export PATH="$FLYCTL_INSTALL/bin:$PATH"
APP=network-capital-app
ENVFILE=/app/backend/.env

if [ -z "${ATLAS_PASSWORD:-}" ]; then echo 'ERROR: set ATLAS_PASSWORD'; exit 1; fi

getv() { grep -E "^$1=" "$ENVFILE" | head -1 | cut -d'=' -f2- | sed 's/^"//; s/"$//'; }

MONGO_URL="mongodb+srv://rmleetang_db_user:${ATLAS_PASSWORD}@cluster0.izoz5gi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

flyctl secrets set -a "$APP" --stage \
  MONGO_URL="$MONGO_URL" \
  JWT_SECRET_KEY="$(getv JWT_SECRET_KEY)" \
  ADMIN_PASSWORD="$(getv ADMIN_PASSWORD)" \
  STRIPE_API_KEY="$(getv STRIPE_API_KEY)" \
  EMERGENT_LLM_KEY="$(getv EMERGENT_LLM_KEY)" \
  BREVO_API_KEY="$(getv BREVO_API_KEY)" \
  CLOUDINARY_CLOUD_NAME="$(getv CLOUDINARY_CLOUD_NAME)" \
  CLOUDINARY_API_KEY="$(getv CLOUDINARY_API_KEY)" \
  CLOUDINARY_API_SECRET="$(getv CLOUDINARY_API_SECRET)" \
  ARIDJA_API_URL="$(getv ARIDJA_API_URL)" \
  ARIDJA_API_KEY="$(getv ARIDJA_API_KEY)" \
  DB_RESTORE_KEY="$(getv DB_RESTORE_KEY)" \
  CORS_ORIGINS="*"

cd /app
flyctl deploy --remote-only -a "$APP" --yes
