#!/bin/bash
# MOBILEPARTS POS: POS, auth va servis buyurtmalarini siqib saqlaydi.
set -euo pipefail

SRC=/var/www/mobileparts-pos/data
DST=/var/backups/mobileparts
KEEP_DAYS=14

mkdir -p "$DST"
chmod 700 "$DST"
STAMP=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for file in pos_database.json auth.json repairs.json; do
  if [[ -f "$SRC/$file" ]]; then
    cp "$SRC/$file" "$TMP/"
  fi
done

# Buzuq JSON zaxiraga yozilmaydi.
python3 -c "import glob,json; [json.load(open(f)) for f in glob.glob('$TMP/*.json')]"
tar -C "$TMP" -czf "$DST/mp-$STAMP.tar.gz" .
chmod 600 "$DST/mp-$STAMP.tar.gz"

find "$DST" -name 'mp-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) ok mp-$STAMP.tar.gz $(du -h "$DST/mp-$STAMP.tar.gz" | cut -f1)" >> "$DST/backup.log"
