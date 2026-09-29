import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Monitor, 
  Download, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  Sparkles, 
  Laptop, 
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Smartphone,
  Apple,
  QrCode,
  Share2,
  Send
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeviceTab = 'pc' | 'android' | 'ios' | 'qr';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  
  // Default tab based on user's current device
  const [activeTab, setActiveTab] = useState<DeviceTab>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'pc'
  );

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleOpenNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent("Paxtaobod Beeline - Buxgalteriya va Ombor Tizimi");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${text}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-black text-2xl shadow-md border border-amber-500 shrink-0">
              B
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg text-stone-900 flex items-center gap-2">
                <span>Telefon & Kompyuterga O'rnatish Qo'llanmasi</span>
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              </h2>
              <p className="text-xs text-stone-500">
                Har qanday telefonda yoki kompyuterda alohida dastur (app) qilib ochish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Link & Sharing Card */}
        <div className="p-3.5 bg-stone-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="text-xs space-y-0.5 text-center sm:text-left">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 justify-center sm:justify-start">
              <Share2 className="w-3.5 h-3.5" />
              <span>Dasturning to'liq internet havolasi:</span>
            </div>
            <p className="text-[11px] text-stone-300 truncate max-w-sm">
              {currentUrl}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="py-2 px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-stone-950" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Nusxalandi!" : "Nusxalash"}</span>
            </button>

            <button
              onClick={handleShareTelegram}
              className="py-2 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Telegram orqali o'zingizga yoki xodimga yuborish"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </button>
          </div>
        </div>

        {/* Direct One-Click Install if supported and triggered */}
        {isInstallable && (
          <div className="p-4 bg-emerald-600 text-white rounded-2xl space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs sm:text-sm flex items-center gap-2">
                <Laptop className="w-4 h-4" />
                <span>Brauzeringiz O'rnatishga Tayyor!</span>
              </span>
            </div>
            <p className="text-xs text-emerald-100">
              Ushbu tugmani bosish orqali dastur 1 soniyada to'g'ridan-to'g'ri o'rnatiladi:
            </p>
            <button
              onClick={async () => {
                await install();
                onClose();
              }}
              className="w-full py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Hoziroq O'rnatish (Avtomatik 1-klik)</span>
            </button>
          </div>
        )}

        {/* Device Switcher Tabs */}
        <div className="flex rounded-xl bg-stone-100 p-1 text-xs font-bold text-stone-600 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pc')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pc' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>1. Kompyuter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'android' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>2. Android Telefon</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ios' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            <Apple className="w-4 h-4 text-stone-900" />
            <span>3. iPhone / iPad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'qr' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            <QrCode className="w-4 h-4 text-amber-600" />
            <span>4. QR Kod</span>
          </button>
        </div>

        {/* Tab 1: Kompyuter (Windows / Mac) */}
        {activeTab === 'pc' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-start gap-2.5">
              <Laptop className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Windows yoki Mac ish stoli (Рабочий стол) uchun:</p>
                <p className="text-blue-900">
                  Dastur brauzer ichida emas, alohida mustaqil oyna sifatida sariq Beeline belgisi bilan ochiladi.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-[11px]">1</span>
                  <span>Avval havolani to'liq yangi vkladkada oching:</span>
                </div>
                <div className="pl-6 pt-1">
                  <button
                    onClick={handleOpenNewTab}
                    className="py-2 px-4 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Dasturni Yangi Vkladkada Ochish</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-[11px]">2</span>
                  <span>Google Chrome yoki Microsoft Edge orqali o'rnatish:</span>
                </div>
                <ul className="pl-6 space-y-1.5 text-stone-700 list-disc">
                  <li>
                    <strong>Google Chrome:</strong> Manzil qatorining o'ng tomonidagi kompyutercha ikonkasini bosing yoki o'ng yuqori burchakdagi <strong>3 ta nuqta (⋮)</strong> &rarr; <strong>"Сохранить и поделиться"</strong> &rarr; <strong>"Установить приложение"</strong> (Install App) ni bosing.
                  </li>
                  <li>
                    <strong>Microsoft Edge:</strong> Manzil qatori o'ngidagi <strong>ilova ikonkasini</strong> yoki <strong>3 ta nuqta (...)</strong> &rarr; <strong>"Приложения" (Apps)</strong> &rarr; <strong>"Установить этот сайт как приложение"</strong> ni bosing.
                  </li>
                  <li>
                    <strong>"Создать ярлык на рабочем столе"</strong> katagiga belgi qo'ying va <strong>"Установить"</strong> ni bosing.
                  </li>
                </ul>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ish stolingizda sariq "Beeline POS" dasturi paydo bo'ladi va sichqonchani ikki marta bosib to'g'ridan-to'g'ri kirasiz!</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Android (Samsung, Xiaomi, Redmi, Honor...) */}
        {activeTab === 'android' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Android smartfonlar (Samsung, Xiaomi, Redmi, Vivo, Honor):</p>
                <p className="text-emerald-900">
                  Play Market'dan yuklangandek alohida ilova bo'lib telefon bosh ekraniga tushadi va butun ekran bo'ylab ishlaydi.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-stone-800">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">1</span>
                  <span>Telefonda Chrome brauzerida oching:</span>
                </div>
                <p className="pl-6 text-stone-600">
                  Dastur havolasini nusxalab telefoningizdagi <strong>Google Chrome</strong> brauzeriga qo'ying yoki QR kodni skanerlang.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">2</span>
                  <span>O'rnatish buyrug'ini bosing:</span>
                </div>
                <ul className="pl-6 space-y-1 text-stone-700 list-disc">
                  <li>Chrome ekranining o'ng yuqori qismidagi <strong>3 ta nuqta (⋮)</strong> tugmasini bosing.</li>
                  <li>Menyudan <strong>"Ilovani o'rnatish"</strong> (ruscha: <em>"Установить приложение"</em>) yoki <strong>"Bosh ekranga qo'shish"</strong> (<em>"Добавить на главный экран"</em>) bandini bosing.</li>
                  <li>Chiqadigan oynada <strong>"O'rnatish" (Установить)</strong> tugmasini bosing.</li>
                </ul>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tayyor! Telefoningiz ekranida sariq Beeline ikonkasi paydo bo'ldi. Internet orqali istalgan joydan kassir va hisobchi kirib ishlashi mumkin.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: iPhone / iPad (Apple iOS Safari) */}
        {activeTab === 'ios' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="p-3 bg-stone-100 border border-stone-300 rounded-2xl text-xs text-stone-950 flex items-start gap-2.5">
              <Apple className="w-5 h-5 text-stone-900 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Apple iPhone va iPad qurilmalari uchun:</p>
                <p className="text-stone-700">
                  Safari brauzeri orqali App Store ilovasi kabi to'liq ekranda o'rnatiladi.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-stone-800">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-[11px]">1</span>
                  <span>Safari brauzerida oching:</span>
                </div>
                <p className="pl-6 text-stone-600">
                  Dastur havolasini iPhone'ingizdagi <strong>Safari</strong> brauzerida oching (Chrome emas, faqat Safari).
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-[11px]">2</span>
                  <span>"Ulashish" (Share) tugmasini bosing:</span>
                </div>
                <p className="pl-6 text-stone-600">
                  Safari pastki panelida joylashgan <strong>kvadrat ichida yuqoriga qaragan strelka (📤 Ulashish)</strong> belgisini bosing.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-[11px]">3</span>
                  <span>"Bosh ekranga qo'shish" ni tanlang:</span>
                </div>
                <ul className="pl-6 space-y-1 text-stone-700 list-disc">
                  <li>Ochilgan menyuni biroz pastga aylantirib <strong>"Bosh ekranga qo'shish"</strong> (ruscha: <em>«На экран "Домой"»</em>, inglizcha: <em>"Add to Home Screen"</em>) ni bosing.</li>
                  <li>O'ng yuqori burchakdagi <strong>"Qo'shish" (Добавить)</strong> tugmasini bosing.</li>
                </ul>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>iPhone ish stolida sariq Beeline dasturi paydo bo'ladi. Bosganingizda alohida ilova sifatida brauzer chiziqlarisiz ochiladi!</span>
              </div>

              {/* iPhone xatoligi bo'yicha yechim */}
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl space-y-2 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>iPhone'da "Action required to load your app" xabari chiqsa:</span>
                </div>
                <div className="space-y-1.5 text-stone-800 text-[11.5px] leading-relaxed">
                  <p>
                    1. Ekranda ko'ringan kulrang <strong>«Authenticate in new window»</strong> tugmasini bitta bosing. Ochilgan kichik oynada ruxsat beriladi va dastur darhol yuklanadi.
                  </p>
                  <p>
                    2. Agar havolani Telegram orqali ochgan bo'lsangiz, Telegram ichida emas, o'ng pastdagi/yuqoridagi <strong>«Safari'da ochish» (Открыть в Safari)</strong> tugmasini bosing.
                  </p>
                  <p>
                    3. Yoki iPhone <strong>Sozlamalar (Настройки) &rarr; Safari &rarr; "Без перекрестн. отслеживания" (Prevent Cross-Site Tracking)</strong> funksiyasini vaqtincha o'chiring.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: QR Kod orqali tezkor ochish */}
        {activeTab === 'qr' && (
          <div className="space-y-3.5 animate-in fade-in text-center">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 text-left">
              <p className="font-bold">Telefondan kamerani yoqing:</p>
              <p className="text-amber-900">
                Telefon kamerangizni quyidagi QR kodga qarating va chiqqan sariq havolani bosing. Dastur bir zumda telefoningizda ochiladi!
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-white rounded-2xl border border-stone-300 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`}
                  alt="Dasturni ochish uchun QR Kod"
                  className="w-48 h-48 object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-xs text-stone-600 font-bold">
                Paxtaobod Beeline POS - Tezkor Ulanish QR Kodi
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <button
                onClick={handleCopyLink}
                className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Havola Nusxalandi!" : "Havolani Nusxalash"}</span>
              </button>

              <button
                onClick={handleShareTelegram}
                className="py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Telegram orqali jo'natish</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-between items-center border-t border-stone-100">
          <button
            onClick={handleOpenNewTab}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>To'liq ekranda ochish</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Tushundim / Yopish
          </button>
        </div>
      </div>
    </div>
  );
};

