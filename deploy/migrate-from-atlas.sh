#!/usr/bin/env bash
# يسحب نسخة كاملة من قاعدة السحابة (Atlas) إلى ملف ثم يمكن استعادتها على السيرفر الجديد.
# الاستعمال:  ./migrate-from-atlas.sh "mongodb+srv://USER:PASS@cluster/..."   ثم   ./restore.sh backups/atlas-XXXX.archive.gz
# يتطلب أدوات mongodb-database-tools على الجهاز الذي ينفذ الأمر.
set -euo pipefail
cd "$(dirname "$0")"
[ $# -eq 1 ] || { echo "الاستعمال: ./migrate-from-atlas.sh \"رابط الاتصال\"" >&2; exit 1; }
mkdir -p backups
F="backups/atlas-$(date +%Y%m%d-%H%M%S).archive.gz"
mongodump --uri "$1" --archive="$F" --gzip
echo "تم: $F — انقله إلى السيرفر الجديد ثم نفّذ ./restore.sh $F"
