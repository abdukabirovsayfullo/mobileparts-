# Jurnal

Faqat oxiriga qo'shiladigan (append-only) xronologik yozuv. Format: `## [YYYY-MM-DD] amal | Sarlavha`.
Amallar: `ingest`, `query`, `lint`, `setup`.
Oxirgi yozuvlar: `grep "^## \[" Jurnal.md | tail -5`

## [2026-09-30] setup | LLM Wiki naqshi joriy etildi
- Jurnal (`[[03-Indexes/Jurnal]]`) yaratildi.
- `AGENTS.md` ga Ingest / Query / Lint / Jurnal qoidalari qo'shildi.
- Holat: `01-Raw` bo'sh, `Manbalar indeksi` bo'sh — birinchi manba kutilmoqda.

## [2026-09-30] ingest | Estoniya D-viza tashqi qidiruv
- Foydalanuvchi ruxsati bilan veb-qidiruv o'tkazildi; rasmiy sahifalarga to'liq kirish bo'lmadi (`politsei.ee` 404, `vm.ee` yurisdiksiyasiz).
- Yaratildi: `01-Raw/2026-09-30 Estoniya D-viza tashqi qidiruv`, `02-Wiki/Concepts/Estoniya D-viza va qisqa muddatli ish`.
- Yangilandi: Manbalar indeksi, Bilim xaritasi, FAQ, Estoniya viza xizmati.

## [2026-09-30] query | Tadqiqotni qabul qilish
- Foydalanuvchi Estoniya D-viza tadqiqoti Vault'da qolishiga rozilik berdi.
- Rasmiy manbada tekshirilgani aytilmadi, shuning uchun da'volar "tashqi, tasdiqlanmagan" holida qoldi.
