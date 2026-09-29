import React from 'react';
import { 
  Menu, 
  FileText, 
  Download, 
  Lock, 
  Unlock, 
  Monitor, 
  Smartphone, 
  TrendingUp, 
  Package, 
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Truck,
  Calculator,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Camera,
  Code2,
  Sparkles
} from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import { StoreSettings } from '../types';
import { AccountingTab } from './Header';
import { PdfReportType } from './PdfReportModal';

interface TopNavbarProps {
  activeTab: AccountingTab;
  onOpenMobileMenu: () => void;
  todayRevenue: number;
  outOfStockCount: number;
  activeDebtsCount: number;
  activeSupplierDebtsCount: number;
  unprintedOrdersCount?: number;
  onOpenTelegramOrders?: () => void;
  storeInfo: StoreSettings;
  isAdminUnlocked: boolean;
  onRequireAdminPin: (targetTab?: AccountingTab) => void;
  onLockAdmin: () => void;
  onOpenPdfReports: (reportType?: PdfReportType) => void;
  onOpenInstallModal: () => void;
  onOpenVazvrat: () => void;
  onOpenPhotoKirim?: () => void;
  onOpenApiModal?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  onOpenMobileMenu,
  todayRevenue,
  outOfStockCount,
  activeDebtsCount,
  activeSupplierDebtsCount,
  unprintedOrdersCount = 0,
  onOpenTelegramOrders,
  storeInfo,
  isAdminUnlocked,
  onRequireAdminPin,
  onLockAdmin,
  onOpenPdfReports,
  onOpenInstallModal,
  onOpenVazvrat,
  onOpenPhotoKirim,
  onOpenApiModal
}) => {
  const getTabDetails = () => {
    switch (activeTab) {
      case 'chiqim':
        return {
          title: 'POS Kassa (Sotuv)',
          subtitle: 'Aksessuarlar chakana va optom savdosi, chek chiqarish va to\'lovlar',
          icon: <ArrowUpRight className="w-5 h-5 text-emerald-500" />
        };
      case 'kirim':
        return {
          title: 'Tovar Kirim Qilish',
          subtitle: 'Yangi partiyani qabul qilish, narx va ta\'minotchi qarzini hisobga olish',
          icon: <ArrowDownLeft className="w-5 h-5 text-sky-500" />
        };
      case 'stock':
        return {
          title: 'Ombor & Tovar Qoldiqlari',
          subtitle: 'Telefon modellari bo\'yicha qoldiqlar, narxlar va shtrix-kodlar',
          icon: <Package className="w-5 h-5 text-amber-500" />
        };
      case 'report':
        return {
          title: 'Kunlik Hisobot & Foyda',
          subtitle: 'Kassa tushumi, toza marja va moliyaviy statistika',
          icon: <BarChart3 className="w-5 h-5 text-amber-500" />
        };
      case 'debts':
        return {
          title: 'Mijoz Nasiyalari',
          subtitle: 'Nasiya daftar, qisman to\'lovlar va mijozlar balansi',
          icon: <BookOpen className="w-5 h-5 text-amber-500" />
        };
      case 'supplier-debts':
        return {
          title: 'Ta\'minotchilar Qarzi',
          subtitle: 'Dilerlardan olingan partiyalar va to\'lov jadvallari',
          icon: <Truck className="w-5 h-5 text-rose-500" />
        };
      case 'journal':
        return {
          title: 'Harakatlar Jurnali',
          subtitle: 'Barcha kirim, chiqim va qaytarish operatsiyalari arxivi',
          icon: <BookOpen className="w-5 h-5 text-stone-500" />
        };
      case 'hisobchi':
        return {
          title: 'Do\'kon Sozlamalari & Hisobchi',
          subtitle: 'Do\'kon rekvizitlari, toifalar boshqaruvi va ommaviy narx belgilash',
          icon: <Calculator className="w-5 h-5 text-purple-500" />
        };
      case 'ai-analyst':
        return {
          title: "AI Tahlilchi & Xarid Maslahatchisi",
          subtitle: "Savdodagi xatolar tahlili, zakaz tavsiyalari va Telegramga past zaxiralarni jo'natish",
          icon: <Sparkles className="w-5 h-5 text-amber-400" />
        };
      case 'telegram-orders':
        return {
          title: "Telegram Mini App & Online Savdo Kassasi",
          subtitle: "Mijoz zakazlari, ombor bilan sinxronizatsiya va avtomatik printer",
          icon: <Smartphone className="w-5 h-5 text-sky-400" />
        };
      default:
        return {
          title: 'Paxtaobod Beeline POS',
          subtitle: 'Aksessuarlar markazi',
          icon: <Smartphone className="w-5 h-5 text-amber-500" />
        };
    }
  };

  const tabInfo = getTabDetails();

  return (
    <header className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Mobile hamburger & Active Page Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Menyuni ochish"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-stone-800 items-center justify-center border border-stone-700/80 shrink-0">
              {tabInfo.icon}
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                {tabInfo.title}
              </h1>
              <p className="hidden sm:block text-[11px] text-stone-400 truncate max-w-xs md:max-w-md">
                {tabInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Buttons & Status Badges */}
        <div className="flex items-center gap-2">
          {/* AI Foto Kirim button */}
          {onOpenPhotoKirim && (
            <button
              type="button"
              onClick={onOpenPhotoKirim}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
              title="AI Foto Kirim (Kamera orqali qog'oz nakladnoy yoki daftar yozuvini o'qish)"
            >
              <Camera className="w-3.5 h-3.5 text-stone-950" />
              <span className="hidden sm:inline">📸 Foto Kirim</span>
              <span className="sm:hidden">📸 Kirim</span>
            </button>
          )}

          {/* Direct Zakaz PDF Button */}
          <button
            type="button"
            onClick={() => onOpenPdfReports('out_of_stock')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            title="Ta'minotchi uchun narxlarsiz zakaz varaqasi"
          >
            <span className="text-sm">📋</span>
            <span className="hidden sm:inline">Zakaz Berish (PDF)</span>
            <span className="sm:hidden">Zakaz</span>
            {outOfStockCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-mono">
                {outOfStockCount}
              </span>
            )}
          </button>

          {/* Daily Sales PDF button */}
          <button
            type="button"
            onClick={() => onOpenPdfReports('daily_sales')}
            className="hidden md:flex px-3 py-1.5 sm:py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
            title="Bugungi savdo hisobotini PDF qilib yuklab olish"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Savdo PDF</span>
          </button>

          {/* Today's Cash Pill */}
          <div className="hidden xl:flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 text-xs">
            <span className="text-stone-400">Kassa:</span>
            <span className="font-mono font-black text-amber-300">{formatMoney(todayRevenue)}</span>
          </div>

          {/* Desktop App Shortcut */}
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="hidden sm:flex w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 items-center justify-center cursor-pointer transition-colors border border-stone-700"
            title="Telefon yoki kompyuterga o'rnatish qo'llanmasi"
          >
            <Monitor className="w-4 h-4 text-amber-400" />
          </button>

          {/* Telegram Mini App & Online Orders Button */}
          {onOpenTelegramOrders && (
            <button
              type="button"
              onClick={onOpenTelegramOrders}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                unprintedOrdersCount > 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30 animate-pulse'
                  : 'bg-stone-800 hover:bg-stone-700 text-sky-300 border-sky-500/30 hover:border-sky-400'
              }`}
              title="Telegram Mini App & Online Zakazlar Kassasi"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">TG Zakaz</span>
              {unprintedOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-mono font-black">
                  {unprintedOrdersCount}
                </span>
              )}
            </button>
          )}

          {/* REST API & 1C Button */}
          {onOpenApiModal && (
            <button
              type="button"
              onClick={onOpenApiModal}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-stone-800 hover:bg-stone-700 text-cyan-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-cyan-500/30 hover:border-cyan-400"
              title="REST API & 1C / Telegram Bot Integratsiyasi"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">API</span>
            </button>
          )}

          {/* Admin Lock Status Button */}
          {isAdminUnlocked ? (
            <button
              type="button"
              onClick={onLockAdmin}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-900/60"
              title="Rahbar rejimi faol. Qulflash uchun bosing."
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Rahbar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRequireAdminPin()}
              className="px-2.5 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-stone-700 hover:text-white"
              title="Rahbar bo'limlarini ochish uchun PIN-kod kiriting"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Kassir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
