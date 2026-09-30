---
type: system-audit
created: 2026-09-29
status: complete
subject: vizaCRM
decision: keep-as-is
---

# vizaCRM tahlili

Tahlil [vizaCRM](https://ankara-viza-crm-vmmt.vercel.app/) tizimining login qilingan ichki sahifalarini faqat o'qish orqali bajarildi. Hisobotda mijozlarning ism, telefon, pasport va fayl ma'lumotlari keltirilmaydi.

> **Sayfullohning qarori — 2026-09-29:** CRM hozirgi holatida qoldiriladi. Ushbu auditdagi takliflar bajariladigan vazifalar emas, faqat kelajak uchun ma'lumot sifatida saqlanadi.

## Qisqa xulosa

CRM yaxshi MVP: mijozlar, jarayon, hujjatlar, xizmatlar, appointment, to'lov va bulut sinxronlash bir joyda. Sayfullohning hozirgi ishini Telegram va tarqoq fayllardan tizimli boshqaruvga o'tkazish uchun mustahkam asos bor.

Keyingi bosqichda dizayndan ko'ra ma'lumot modeli muhim. CRM real biznes qoidalariga moslashtirilmasa, panel chiroyli ko'rinsa ham moliya, xizmat va maxfiylik bo'yicha noto'g'ri xulosa chiqaradi.

## Hozir mavjud kuchli funksiyalar

- e-mail va parol orqali kirish;
- Supabase bulutida saqlash va qurilmalararo sinxronlash;
- Ankara va Astana bo'yicha ajratish;
- mijoz statuslari;
- jadval va Kanban ko'rinishi;
- hujjat/fayl biriktirish;
- anketa, sug'urta, bron va appointment xizmat statuslari;
- appointment sanasi va vaqti;
- kelishilgan, to'langan va qoldiq summalar;
- qidiruv va filterlar;
- mijozlar hamda to'lovlarni eksport qilish;
- JSON zaxira nusxasini yuklab olish va tiklash;
- yorug', tungi va tizim rejimi;
- ichki qo'llanma.

## Hozirgi CRM holati

- 7 ta mijoz qayd etilgan.
- Barchasi Ankara yo'nalishida; Astana yozuvi yo'q.
- 6 ta appointment belgilangan, 1 ta appointment kutilmoqda.
- Tizimda hozircha muvaffaqiyatli yakunlangan viza 0 ta deb ko'rsatilgan.
- Jami kelishilgan summa 2 600 USD.
- Qabul qilingan to'lov 300 USD.
- Qoldiq to'lov 2 300 USD.
- To'lovlar tarixi 0 ta ko'rinadi, lekin umumiy qabul qilingan summa 300 USD. Bu audit izida nomuvofiqlik borligini ko'rsatadi.

## Eng muhim nomuvofiqliklar

### 1. Paket narxi bir xil emas

Biznes suhbatida asosiy paket 350 USD deb belgilangan. CRM ichida esa 300, 350 va 400 USD qiymatlar bor. Buning sababi saqlanishi kerak:

- eski narx;
- maxsus kelishuv;
- boshqa xizmat paketi;
- chegirma;
- qo'shimcha xizmat.

Faqat summa saqlansa, daromad va marjani tahlil qilish noto'g'ri bo'ladi.

### 2. To'lov modeli mos emas

Amaldagi qoida bo'yicha 350 USD Ankaraga kelganda hamkorga naqd beriladi. CRM'da ayrim mijozlarda oldindan 100 USD qisman to'lov ko'rinadi. Bu haqiqatda mavjud bo'lsa, to'lov turi va sababi aniq bo'lishi kerak. Mavjud bo'lmasa, eski yoki noto'g'ri yozuvlarni tekshirish kerak.

### 3. To'lovlar tarixi ishlatilmayapti

Umumiy qabul qilingan summa bor, lekin to'lovlar tarixi 0 ta. Har bir pul harakati alohida tranzaksiya bo'lishi kerak:

- sana;
- summa;
- valyuta;
- naqd/karta;
- kim qabul qildi;
- qaysi mijoz;
- izoh yoki tasdiq.

### 4. Hamkor bilan hisob-kitob yo'q

CRM 350 USD mijoz to'lovini ko'radi, ammo quyidagilarni alohida kuzatmaydi:

- hamkor 150 USD olib qoldimi;
- Sayfullohga 200 USD yuborildimi;
- o'tkazma sanasi;
- sug'urta 30 USD;
- mayda xarajat 20 USD;
- Sayfulloh marjasi 150 USD.

Bu modul bo'lmasa CRM tushumni ko'rsatadi, lekin haqiqiy foydani ko'rsatmaydi.

### 5. Xizmat nomlari real paketga to'liq mos emas

CRM'da `Bilet va mehmonxona bronlari` mavjud. Sayfullohning amaldagi modeli esa kvartira, sug'urta, aeroport kutib olish, elchixona transferi va tarjimonlikdan iborat. Quyidagi statuslar kerak:

- hujjatlar tayyor;
- sug'urta tayyor;
- appointment olindi;
- aviachipta mijoz tomonidan olindi;
- Esenboğa kutib olish rejalashtirildi/bajarildi;
- kvartiraga joylashtirildi;
- elchixonaga olib borildi;
- tarjimonlik bajarildi;
- pasportni mijoz oldi;
- xizmat yakunlandi.

### 6. Mijoz manbasi yo'q yoki ko'rinmaydi

Biznesda 70% tavsiya, 30% Telegram. CRM'da `Telegram`, `tavsiya`, `Instagram`, `boshqa` manbasi va tavsiya qilgan shaxs maydoni ko'rinishi kerak. Aks holda qaysi kanal pul olib kelayotgani o'lchanmaydi.

### 7. Bekor qilish jarayoni yo'q

Mijoz kelmay qolsa 50 USD ankета va sug'urta xarajati bor. CRM'da:

- bekor qilindi statusi;
- sabab;
- 50 USD to'landi/to'lanmadi;
- karta orqali to'lov sanasi bo'lishi kerak.

### 8. Kvartira muddati va qo'shimcha kunlar yo'q

Paket bir oygacha turar joyni qoplaydi. Bir oydan keyin kuniga 10 USD. CRM kirish sanasi, chiqish sanasi, paket ichidagi kunlar va qo'shimcha kun to'lovini avtomatik hisoblamaydi.

## Maxfiylik va xavfsizlik

### Yuqori ustuvorlik

- Mijozlar jadvalida pasport raqami to'liq ko'rinadi. Ro'yxatda faqat oxirgi 3–4 belgi ko'rsatilishi, to'liq raqam faqat mijoz detalida ochilishi kerak.
- Appointment jadvalida telefon raqami to'liq ko'rinadi. Uni ham qisman niqoblash kerak.
- JSON backup pasport, telefon va to'lov ma'lumotlarini saqlashi mumkin. Yuklangan backup himoyalangan papkada saqlanishi va keraksiz nusxalar o'chirilishi kerak.
- Login paroli chat orqali ulashilgan. Uni imkon qadar tez yangilash va boshqa xizmatlarda qayta ishlatmaslik kerak.

### Qo'shilishi kerak

- ikki bosqichli autentifikatsiya;
- rollar: admin va hamkor/xodim;
- hamkor faqat o'ziga kerak mijoz va appointmentni ko'rishi;
- kim qaysi ma'lumotni qachon o'zgartirganini ko'rsatuvchi audit log;
- fayllarga kirish muddati va xavfsiz o'chirish qoidasi;
- mijozning shaxsiy ma'lumotlarni qayta ishlashga roziligi;
- avtomatik yoki rejalashtirilgan backup eslatmasi.

## Statuslar uchun tavsiya

Hozirgi statuslar yetarli emas. Tavsiya etilgan oqim:

1. Yangi murojaat
2. Priglasheniye tekshirildi
3. Dastlabki ma'lumotlar olindi
4. Hujjatlar tayyorlanmoqda
5. Appointment kutilmoqda
6. Appointment olindi
7. Safar rejalashtirildi
8. Ankaraga yetib keldi
9. Elchixonaga topshirdi
10. Qaror kutilmoqda
11. Pasport olindi
12. Muvaffaqiyatli yakunlandi
13. Rad etildi
14. Bekor qilindi

## Mijoz kartasiga qo'shiladigan maydonlar

- priglasheniye bor/yo'q;
- mijoz manbasi;
- tavsiya qilgan odam;
- xizmat paketi;
- standart narx va narx o'zgarishi sababi;
- kelish va chiqish sanasi;
- aeroport kutib olish;
- kvartira muddati;
- qo'shimcha kunlar × 10 USD;
- suhbat tili;
- tarjimon kerak/bajarildi;
- hamkor naqd 350 USD oldi;
- hamkor 150 USD olib qoldi;
- Sayfullohga 200 USD yuborildi;
- sug'urta 30 USD;
- mayda xarajat 20 USD;
- sof marja;
- bekor qilish 50 USD;
- to'lov tasdig'i yuborildi;
- pasport mijoz tomonidan olindi.

## Dashboard uchun to'g'ri KPI'lar

- yangi murojaatlar;
- malakali murojaatlar: priglasheniyesi bor;
- Telegram va tavsiya ulushi;
- murojaatdan mijozga konversiya;
- faol mijozlar;
- 3 kun ichida appointment olinganlar;
- 15–30 kun oralig'ida qaror chiqqanlar;
- muvaffaqiyat va rad natijalari;
- tushum;
- xarajat;
- sof marja;
- hamkordan olinishi kerak bo'lgan pul;
- bekor qilingan xizmatlar;
- muddati yaqin appointmentlar.

## Amalga oshirish ustuvorligi

### P0 — darhol

1. Login parolini yangilash.
2. Pasport va telefonni ro'yxatlarda niqoblash.
3. To'lovlar tarixidagi 0 ta yozuv va 300 USD qabul qilingan summa nomuvofiqligini tuzatish.
4. Har bir mijoz summasi nega 300/350/400 ekanini belgilash.

### P1 — biznes hisobi

1. Hamkor hisob-kitobi va sof marja.
2. Mijoz manbasi va referral.
3. Real xizmat statuslari.
4. Bekor qilish va 50 USD xarajat.
5. Kvartira va qo'shimcha kunlar.

### P2 — o'sish va avtomatlashtirish

1. Eslatmalar va muddati yaqin vazifalar.
2. Telegram javob shablonlari.
3. Haftalik KPI hisoboti.
4. Backup eslatmasi.
5. Hamkor uchun cheklangan rol.

## Yakuniy baho

CRM ishlatishga yaroqli va foydali asosga ega. Eng katta imkoniyat yangi ekranlar qo'shish emas, mavjud tizimni Sayfullohning real paket iqtisodiyoti va xizmat oqimiga moslashtirishdir. P0 va P1 bajarilgach, CRM mijoz ro'yxati bo'lishdan chiqib, haqiqiy operatsion va moliyaviy boshqaruv tizimiga aylanadi.
