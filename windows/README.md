# Windows 11 Pro: XP-80 avtomatik chek

1. Windows Settings > Bluetooth & devices > Printers & scanners orqali "Let Windows manage my default printer"ni o'chiring.
2. Xprinter XP-80 ni asosiy printer qilib belgilang. Printing preferences'da 80 mm rulon formatini tanlang. Avval Windows test page chiqarib tekshiring.
3. CRM-AvtoPrint.cmd faylini yuklab, ish stoliga qo'ying va ikki marta bosing.
4. Savdoni shu ochilgan CRM oynasida bajaring. "Sotuvdan so'ng darhol chek oynasini ochish" belgilangan bo'lsin.
5. Chiqim tasdiqlanganda chek chop etish chaqiriladi. Chrome --kiosk-printing rejimi asosiy printerga tasdiqsiz yuboradi.

Bu yorliq alohida Chrome profilidan foydalanadi. Oddiy Chrome yoki o'rnatilgan PWA yorlig'i orqali ochilsa, tasdiqlash oynasi chiqadi.
Printer yuborilgan ishni qabul qilganini CRM aniqlay olmaydi. Yozuv qayta chop kerak bo'lsa, mavjud chekdagi "Printerga chiqarish"ni bosing; savdoni yana tasdiqlamang.
PDF tugmasi faylni saqlash uchun qoladi.
Avtomatik rejimda faqat CRM uchun ushbu oynadan foydalaning: undagi chop etish so'rovlari tasdiqsiz asosiy printerga yuboriladi.
