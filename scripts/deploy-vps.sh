#!/usr/bin/env bash
# MobileParts POS — VPS'ga yangi versiyani joylash (pm2).
# Ishlatish (VPS'da):
#   curl -fsSL https://raw.githubusercontent.com/abdukabirovsayfullo/mobileparts-/main/scripts/deploy-vps.sh -o /tmp/mp-deploy.sh && bash /tmp/mp-deploy.sh
# Faqat dist/ almashtiriladi; data/ ga tegilmaydi (faqat zaxira olinadi).
# Yangi versiya ishga tushmasa, avtomatik eski versiyaga qaytadi.
set -euo pipefail
# Eslatma: "curl ... | bash" bilan ishga tushirilsa, npm/vite/pm2 skriptning qolgan qismini stdin'dan
# o'qib yubormasligi uchun ular "</dev/null" bilan chaqiriladi.

REPO="https://github.com/abdukabirovsayfullo/mobileparts-.git"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/mobileparts-pos}"
PM2_NAME="${PM2_NAME:-mobileparts-pos}"
PORT="${PORT:-3000}"

log() { echo -e "\n==> $*"; }

[[ -f "$APP_DIR/dist/server.cjs" ]] || { echo "XATO: $APP_DIR/dist/server.cjs topilmadi"; exit 1; }

BUILD_DIR="$(mktemp -d /tmp/mp-build.XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT

log "1/6 GitHub'dan yuklanmoqda ($BRANCH)"
git clone -q --depth 200 --branch "$BRANCH" "$REPO" "$BUILD_DIR/src" </dev/null
cd "$BUILD_DIR/src"
SHA="$(git rev-parse --short HEAD)"
echo "Versiya: $SHA — $(git log -1 --pretty=%s)"

# Himoya: serverdagi versiya shu skript orqali joylanmagan bo'lsa (masalan Codex yoki qo'lda),
# yoki joylangan versiya bu kodning ichida bo'lmasa, ustidan yozilmaydi.
MARKER="$APP_DIR/.deployed-sha"
if [[ "${FORCE:-0}" != 1 ]]; then
  if [[ ! -f "$MARKER" ]]; then
    echo "TO'XTATILDI: serverdagi versiya qayerdan kelgani noma'lum (.deployed-sha yo'q)."
    echo "Agar GitHub'dagi kod serverdagidan yangi ekaniga ishonchingiz komil bo'lsa: FORCE=1 bilan ishga tushiring."
    exit 1
  fi
  if [[ "$APP_DIR/dist/index.html" -nt "$MARKER" ]]; then
    echo "TO'XTATILDI: server oxirgi deploydan keyin boshqa yo'l bilan yangilangan (dist o'zgargan)."
    echo "Avval o'sha o'zgarishlarni GitHub'ga yuklang. Hech narsa o'zgartirilmadi."
    exit 1
  fi
  PREV="$(cat "$MARKER")"
  if ! git merge-base --is-ancestor "$PREV" HEAD 2>/dev/null; then
    echo "TO'XTATILDI: serverdagi versiya ($PREV) GitHub'dagi '$BRANCH' tarixida yo'q."
    exit 1
  fi
fi

log "2/6 Build qilinmoqda (bir necha daqiqa)"
npm install --no-audit --no-fund --loglevel=error </dev/null
npm run build </dev/null
[[ -f dist/server.cjs && -f dist/index.html ]] || { echo "XATO: build natijasi to'liq emas"; exit 1; }

log "3/6 Server kutubxonalari tekshirilmoqda"
MISSING=""
for mod in $(grep -oE 'require\("[^"]+"\)' dist/server.cjs | sed -E 's/require\("([^"]+)"\)/\1/' | grep -vE '^(node:|\.|/)' | sort -u); do
  case "$mod" in fs|path|crypto|os|http|https|url|util|stream|events|zlib|child_process|buffer|net|tls|querystring) continue;; esac
  (cd "$APP_DIR" && node -e "require.resolve(process.argv[1])" "$mod" 2>/dev/null </dev/null) || MISSING="$MISSING $mod"
done
if [[ -n "$MISSING" ]]; then
  echo "Yetishmayotgan kutubxonalar:$MISSING — o'rnatilmoqda"
  (cd "$APP_DIR" && npm install --no-save --no-audit --no-fund --loglevel=error $MISSING </dev/null)
fi

STAMP="$(date +%Y%m%dT%H%M%S)"
log "4/6 Zaxira: data/ va joriy dist/"
mkdir -p "$APP_DIR/backups/deploy"
tar -C "$APP_DIR" -czf "$APP_DIR/backups/deploy/data-$STAMP.tar.gz" data
ROLLBACK="$APP_DIR/dist.rollback-before-$SHA-$STAMP"
cp -a "$APP_DIR/dist" "$ROLLBACK"
echo "data zaxirasi: backups/deploy/data-$STAMP.tar.gz"
echo "eski dist:     $(basename "$ROLLBACK")"

log "5/6 Yangi versiya qo'yilmoqda va qayta ishga tushirilmoqda"
rm -rf "$APP_DIR/dist.new"
cp -a dist "$APP_DIR/dist.new"
rm -rf "$APP_DIR/dist"
mv "$APP_DIR/dist.new" "$APP_DIR/dist"
pm2 restart "$PM2_NAME" --update-env >/dev/null </dev/null

log "6/6 Tekshirilmoqda"
OK=0
for i in $(seq 1 15); do
  sleep 2
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 </dev/null; then OK=1; break; fi
done

if [[ "$OK" != 1 ]]; then
  echo "XATO: yangi versiya javob bermadi — eski versiyaga qaytarilmoqda"
  pm2 logs "$PM2_NAME" --lines 30 --nostream </dev/null || true
  rm -rf "$APP_DIR/dist.failed-$STAMP-$SHA"
  mv "$APP_DIR/dist" "$APP_DIR/dist.failed-$STAMP-$SHA"
  cp -a "$ROLLBACK" "$APP_DIR/dist"
  pm2 restart "$PM2_NAME" --update-env >/dev/null </dev/null
  exit 1
fi

pm2 save >/dev/null 2>&1 </dev/null || true
git rev-parse HEAD > "$MARKER"

# Joy tejash: shu skript yaratgan eski nusxalardan faqat oxirgilarini qoldiramiz.
KEEP_DIST="${KEEP_DIST:-5}"
KEEP_DATA="${KEEP_DATA:-20}"
ls -1dt "$APP_DIR"/dist.rollback-before-* 2>/dev/null | tail -n +"$((KEEP_DIST + 1))" | xargs -r rm -rf
ls -1t "$APP_DIR"/backups/deploy/data-*.tar.gz 2>/dev/null | tail -n +"$((KEEP_DATA + 1))" | xargs -r rm -f
npm cache clean --force >/dev/null 2>&1 </dev/null || true
echo -e "\n✅ Tayyor: $SHA ishga tushdi. Brauzerda Ctrl+Shift+R bosing."
echo "Orqaga qaytarish kerak bo'lsa:"
echo "  cd $APP_DIR && rm -rf dist && cp -a $(basename "$ROLLBACK") dist && pm2 restart $PM2_NAME"
