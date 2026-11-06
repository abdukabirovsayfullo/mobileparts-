---
type: project
status: planned
owner: Sayfulloh
updated: 2026-09-29
---

# Telefon aksessuarlari do'koni AI tizimi

## Vizyon

Do'konda kassir sifatida real jarayonlarni o'rganish, so'ng savdo va boshqaruvni ma'lumotga asoslangan AI tizimi bilan bosqichma-bosqich rivojlantirish.

## Ish holati

- Sayfulloh do'kon uchun AI Studio'da dastlabki CRM tizimini yaratdi va online mini app qildi.
- **Hozirgi muammolar:** 
  1. CRM xotiraga (baza) bog'lanmagan.
  2. Tizimni xosting qilishda qiyinchiliklar bor.
  3. Mahsulotlarni mini app orqali qo'lda kiritish juda ko'p vaqt olyapti va qiyinchilik tug'diryapti.
- Rejalashtirilgan smena: 07:00–19:00. Haftasiga 7 kun. Rejalashtirilgan maosh: 500 USD.
- Ish boshlangach, dastlabki 2–4 hafta kuzatuv va ma'lumot yig'ishga ajratiladi. (Do'kon mijozi kelganda kassirlik har doim birinchi o'rinda).

## Loyiha va Kod bazasi

- **GitHub Repository:** [mobileparts-](https://github.com/abdukabirovsayfullo/mobileparts-)
- **Asosiy manzil (Local):** `C:\Users\User\.gemini\antigravity\scratch\mobileparts-`
- **Texnologik stek:**
  - Frontend: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Motion
  - Backend: Node.js, Express.js, TypeScript (TSX)
  - Sun'iy Intellekt: Google Gemini API (`@google/genai`)
  - Ma'lumotlar bazasi: `server/dataStore.ts` orqali `data/pos_database.json` (doimiy xotira)
  - PWA va Telegram Web App (Mini App) integratsiyasi

## Asosiy Modullar va Yechimlar

1. **Mahsulotlarni tez kiritish (Kirim qilish):**
   - `PhotoKirimModal.tsx` — **Gemini AI Vision** orqali yetkazib beruvchining qog'oz fakturasi (nakladnoy) yoki mahsulot qutisini suratga olib, avtomatik tovar nomi, narxi va sonini ajratib bazaga yozish.
   - `ExcelImportModal.tsx` — Excel fayl orqali ommaviy tovar yuklash.
2. **Kassa va Savdo (POS):**
   - `App.tsx` & `ChiqimFormView.tsx` — real vaqtda sotuv, to'lov usullari (naqd, karta, o'tkazma, qarz), chek chiqarish (`PrintReceiptModal`).
3. **Qarzlar va Ta'minotchilar:**
   - `DebtsView.tsx` (Mijozlar qarzlari) va `SupplierDebtsView.tsx` (Ta'minotchilardan olingan nasiya tovarlar).
4. **AI Maslahatchi va Tahlil:**
   - `AiAnalystView.tsx` & `server/aiAdvisor.ts` — savdo tahlili, eng ko'p sotilgan mahsulotlar va AI tavsiyalari.
5. **Telegram Mini App:**
   - `TelegramMiniAppView.tsx` & `server/telegram.ts` — mijozlar uchun onlayn vitrina va buyurtma berish.

## Xosting va Ishga tushirish rejasi

- **Server hosting:** Render.com yoki Railway (Node.js Express + Frontend yagona servis sifatida ishlaydi).
- **Telegram Web App:** Render/Railway bergan HTTPS domenini Telegram botdagi Menu Button / Web App URL'ga ulash.

## Ehtiyot choralari

AI pul, narx yoki buyurtma bo'yicha mustaqil yakuniy qaror qabul qilmasin. Avval tavsiya beradi, Sayfulloh yoki do'kon egasi tasdiqlaydi.
