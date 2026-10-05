#!/bin/bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$TASK_ROOT"
if [ ! -f "$TASK_ROOT/config.js" ] || [ ! -f "$TASK_ROOT/supabase/functions/dashboard-ai/index.ts" ]; then
  TASK_DOWNLOAD="$(mktemp -d "${TMPDIR:-/tmp}/swnw-secure-ai.XXXXXX")"
  curl --fail --silent --show-error --location 'https://github.com/mohamedabdelaalhub/sono-dashboard/archive/refs/heads/main.zip' --output "$TASK_DOWNLOAD/project.zip"
  unzip -q "$TASK_DOWNLOAD/project.zip" -d "$TASK_DOWNLOAD"
  TASK_ROOT="$TASK_DOWNLOAD/sono-dashboard-main"
  cd "$TASK_ROOT"
fi
if ! command -v node >/dev/null || ! command -v npx >/dev/null; then
  echo 'ثبّت Node.js ثم افتح هذا الملف مرة أخرى.'
  read -r -p 'اضغط Enter للإغلاق' _answer
  exit 1
fi
PROJECT_REF="$(node -e 'const fs=require("fs"),s=fs.readFileSync("config.js","utf8"),m=s.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);if(!m)process.exit(1);process.stdout.write(m[1]);')"
echo 'سجّل الدخول إلى حساب Supabase الذي يملك مشروع الداشبورد.'
npx --yes supabase login
npx --yes supabase functions deploy dashboard-ai --project-ref "$PROJECT_REF"
if command -v pbcopy >/dev/null && command -v open >/dev/null; then
  pbcopy < "$TASK_ROOT/supabase/migration-secure-ai.sql"
  open "https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
  echo 'نسخت كود التفعيل. الصقه في SQL Editor واضغط Run.'
else
  echo 'افتح SQL Editor في المشروع وشغّل supabase/migration-secure-ai.sql.'
fi
echo 'بعد نجاح التنفيذ سجّل الخروج من الداشبورد ثم الدخول واختبر التحليل الذكي.'
read -r -p 'اضغط Enter للإغلاق' _answer
