#!/usr/bin/env bash
# استعادة نسخة: ./restore.sh backups/marhaba-XXXX.archive.gz   (تستبدل البيانات الحالية)
# يُستعمل أيضًا لإدخال بيانات مأخوذة من السحابة بعد تشغيل migrate-from-atlas.sh
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
[ $# -eq 1 ] && [ -f "$1" ] || { echo "الاستعمال: ./restore.sh ملف.archive.gz" >&2; exit 1; }
read -r -p "ستُستبدل البيانات الحالية. اكتب نعم للمتابعة: " ok
[ "$ok" = "نعم" ] || { echo "أُلغي"; exit 1; }
docker compose exec -T mongo mongorestore --drop -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip < "$1"
docker compose restart api
echo "تمت الاستعادة"
