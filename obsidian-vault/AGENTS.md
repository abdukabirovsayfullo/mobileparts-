# Ikkinchi miya uchun agent qoidalari

## Maqsad

Ushbu Obsidian Vault foydalanuvchining uzoq muddatli shaxsiy bilim bazasidir. Agent yangi manbalarni tartiblaydi, ishonchli wiki maqolalarini yaratadi, qaydlar orasidagi bog'lanishlarni saqlaydi va tadqiqot natijalarini faylga yozadi.

## Papkalar vazifasi

- `00-Inbox`: hali tartiblanmagan materiallar.
- `01-Raw`: asl manbalar. Ularni tahrirlama yoki o'chirma; faqat foydalanuvchi aniq so'rasa mumkin.
- `02-Wiki`: qayta ishlangan bilim maqolalari.
- `03-Indexes`: navigatsiya, mavzu va manba indekslari.
- `04-Outputs`: savol-javob va tadqiqot natijalari.
- `05-Templates`: qayd shablonlari.
- `Attachments`: rasm va boshqa biriktirmalar.
- `06-Men`: foydalanuvchining shaxsiy konteksti, maqsadlari, qadriyatlari va afzalliklari.

## Ishlash qoidalari

1. Mavjud matnni asossiz almashtirma va foydalanuvchi yozuvlarini saqla.
2. Fakt, xulosa va taxminni bir-biridan aniq ajrat.
3. Har bir muhim da'voni mavjud manba qaydiga yoki `01-Raw` fayliga bog'la.
4. Obsidian ichki havolalari uchun `[[Fayl nomi]]` formatidan foydalan.
5. Bir tushuncha uchun takroriy maqola yaratishdan oldin `02-Wiki` ichidan qidir.
6. Yangi maqola yaratganda tegishli indeks va backlinklarni ham yangila.
7. Manbada bo'lmagan ma'lumotni qo'shsang, uni tashqi tadqiqot yoki taxmin sifatida belgilab, manbasini ko'rsat.
8. Qarama-qarshi ma'lumotlarni yashirma; alohida bo'limda ko'rsat.
9. Foydalanuvchi savoliga katta javobni chatda qoldirish o'rniga `04-Outputs` ichiga yoz va chatda qisqa xulosa ber.
10. Fayl nomlari qisqa, mazmunli va inson o'qiy oladigan bo'lsin.
11. Javob va tavsiyalarni `06-Men` ichidagi tasdiqlangan ma'lumotlarga moslashtir.
12. Foydalanuvchi haqida dalilsiz xulosa chiqarma. Noaniq ma'lumotni savol yoki taxmin sifatida belgilagin.
13. Yangi shaxsiy ma'lumotni faqat foydalanuvchi aytganida yoki tasdiqlaganida profilga qo'sh.
14. Parol, maxfiy kalit, bank karta raqami, pasport raqami va autentifikatsiya kodlarini saqlama.
15. Vaqt o'tishi bilan o'zgaradigan ma'lumotlarda sana va eski holatni imkon qadar saqla.

## Incremental kompilyatsiya

Yangi material kelganda faqat tegishli qaydlarni qayta ishlashga harakat qil. Har safar butun Vault'ni qayta yozma. O'zgargan manbalar, ularning wiki maqolalari va bog'liq indekslarni yangila.

## Sifat tekshiruvi

Ish yakunida:

- yangi va o'zgargan fayllarni sanab chiq;
- buzilgan ichki havolalarni tekshir;
- manbasiz muhim da'volarni belgilab qo'y;
- qaysi ma'lumotlar noaniq ekanini ayt;
- foydalanuvchiga tavsiya etiladigan keyingi bitta amaliy qadamni ko'rsat.

## Amallar (LLM Wiki naqshi)

- **Ingest**: yangi manbani o'qi → foydalanuvchi bilan asosiy xulosalarni muhokama qil → manba qaydi va kerakli `02-Wiki` maqolalarini yarat/yangila → `03-Indexes` (jumladan `Manbalar indeksi`) ni yangila → `[[03-Indexes/Jurnal]]` ga yozuv qo'sh. Bitta manba odatda bir nechta maqolaga ta'sir qiladi.
- **Query**: avval `Bilim xaritasi` va indekslarni o'qi, so'ng tegishli maqolalarga o't. Qimmatli javoblarni `04-Outputs` ga yoz va kerak bo'lsa wiki'ga qayta bog'la, shunda bilim to'planib boradi.
- **Lint**: qarama-qarshiliklar, eskirgan da'volar, orphan (kiruvchi havolasiz) sahifalar, o'z sahifasi yo'q muhim tushunchalar, yetishmayotgan o'zaro havolalar va veb-qidiruv bilan to'ldirsa bo'ladigan bo'shliqlarni tekshir. Natijani Jurnalga `lint` sifatida yoz.
- **Jurnal**: `03-Indexes/Jurnal.md` faqat oxiriga qo'shiladi; yozuv `## [YYYY-MM-DD] amal | Sarlavha` formatida bo'ladi.
