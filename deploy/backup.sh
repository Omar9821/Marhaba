#!/usr/bin/env bash
# نسخة احتياطية يومية لكل قواعد البيانات (المركزية وقاعدة كل فرع). تُحفظ 30 يومًا.
# تشغيل يدوي: ./backup.sh     جدولة يومية 02:00: crontab -e  ثم:  0 2 * * * /مسار/deploy/backup.sh >> /مسار/deploy/backups/backup.log 2>&1
# نسخ خارجي اختياري: عرّف REMOTE (مثل REMOTE=mycloud:marhaba) بعد إعداد rclone.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
mkdir -p backups
F="backups/marhaba-$(date +%Y%m%d-%H%M%S).archive.gz"
docker compose exec -T mongo mongodump --quiet -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > "$F"
[ -s "$F" ] || { echo "فشل النسخ: الملف فارغ" >&2; rm -f "$F"; exit 1; }
find backups -name 'marhaba-*.archive.gz' -mtime +30 -delete
if [ -n "${REMOTE:-}" ]; then rclone copy "$F" "$REMOTE" --quiet; fi
echo "تم: $F ($(du -h "$F" | cut -f1))"
