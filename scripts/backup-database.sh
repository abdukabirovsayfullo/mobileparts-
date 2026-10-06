#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MOBILEPARTS_APP_DIR:-/var/www/mobileparts-pos}"
DATA_FILE="${APP_DIR}/data/pos_database.json"
BACKUP_DIR="${APP_DIR}/backups/daily"
RETENTION_DAYS="${MOBILEPARTS_BACKUP_RETENTION_DAYS:-35}"

mkdir -p "${BACKUP_DIR}"
exec 9>"${BACKUP_DIR}/.backup.lock"
flock -n 9 || exit 0

if [[ ! -s "${DATA_FILE}" ]]; then
  echo "[$(date --iso-8601=seconds)] backup failed: database is missing or empty" >&2
  exit 1
fi

# Never archive a partially written or invalid JSON database.
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "${DATA_FILE}"

timestamp="$(TZ=Asia/Tashkent date +%Y-%m-%d_%H-%M-%S)"
temporary="${BACKUP_DIR}/.pos_database_${timestamp}.json"
archive="${BACKUP_DIR}/pos_database_${timestamp}.json.gz"

cp --preserve=mode,timestamps "${DATA_FILE}" "${temporary}"
gzip -9 "${temporary}"
mv "${temporary}.gz" "${archive}"
sha256sum "${archive}" > "${archive}.sha256"

find "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'pos_database_*.json.gz' -o -name 'pos_database_*.json.gz.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date --iso-8601=seconds)] backup created: ${archive}"
