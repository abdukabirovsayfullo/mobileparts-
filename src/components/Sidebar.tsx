import React from 'react';
import { 
  BarChart3, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileText, 
  Package, 
  BookOpen, 
  TrendingUp, 
  Smartphone,
  PlusCircle,
  MinusCircle,
  Monitor,
  Truck,
  Calculator,
  Lock,
  Unlock,
  ShieldCheck,
  KeyRound,
  RotateCcw,
  FileSpreadsheet,
  AlertTriangle,
  X,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Camera,
  Download,
  Code2
} from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import { StoreSettings } from '../types';
import { AccountingTab } from './Header';
import { PdfReportType } from './PdfReportModal';

interface SidebarProps {
  activeTab: AccountingTab;
  setActiveTab: (tab: AccountingTab) => void;
  todayRevenue: number;
  todayProfit?: number;
  activeDebtsCount: number;
  activeSupplierDebtsCount?: number;
  outOfStockCount?: number;
  storeInfo: StoreSettings;
  isAdminUnlocked: boolean;
  onRequireAdminPin: (targetTab?: AccountingTab) => void;
  onLockAdmin: () => void;
  onOpenVazvrat: () => void;
  onOpenExcelImport: () => void;
  onOpenPdfReports: (reportType?: PdfReportType) => void;
  onOpenInstallModal: () => void;
  onOpenPhotoKirim?: () => void;
  onOpenApiModal?: () => void;
  unprintedOrdersCount?: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  todayRevenue,
  todayProfit,
  activeDebtsCount,
  activeSupplierDebtsCount = 0,
  outOfStockCount = 0,
  unprintedOrdersCount = 0,
  storeInfo,
  isAdminUnlocked,
  onRequireAdminPin,
  onLockAdmin,
  onOpenVazvrat,
  onOpenExcelImport,
  onOpenPdfReports,
  onOpenInstallModal,
  onOpenPhotoKirim,
  onOpenApiModal,
  isMobileOpen,
  onCloseMobile
}) => {
  const handleTabClick = (tab: AccountingTab) => {
    const protectedTabs: AccountingTab[] = ['report', 'supplier-debts', 'hisobchi', 'ai-analyst'];
    if (protectedTabs.includes(tab) && !isAdminUnlocked) {
      onRequireAdminPin(tab);
      onCloseMobile();
      return;
    }
    setActiveTab(tab);
    onCloseMobile();
  };

  const navItemClass = (isActive: boolean, isLocked: boolean = false) => {
    if (isActive) {
      return 'bg-amber-400 text-stone-950 font-black shadow-md border border-amber-300';
    }
    if (isLocked) {
      return 'text-stone-400 hover:text-stone-200 hover:bg-stone-900 border border-transparent';
    }
    return 'text-stone-300 hover:text-white hover:bg-stone-900 border border-transparent';
  };

  if (!isAdminUnlocked) {
    return (
      <>
        {isMobileOpen && <div onClick={onCloseMobile} className="fixed inset-0 z-40 bg-black/70 lg:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-stone-950 text-white border-r border-stone-800 flex flex-col transition-transform lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5" /></div>
              <div className="min-w-0"><div className="font-black text-sm truncate">{storeInfo.name}</div><div className="text-[10px] text-emerald-400 font-bold">● KASSA ONLAYN</div></div>
            </div>
            <button type="button" onClick={onCloseMobile} className="lg:hidden p-2"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-3 flex-1">
            <button type="button" onClick={() => handleTabClick('chiqim')} className="w-full rounded-xl bg-amber-400 px-4 py-3 text-stone-950 font-black flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> Sotuv va qidiruv
            </button>
            <p className="mt-4 px-2 text-[11px] leading-relaxed text-stone-500">Kassir rejimida faqat tovar qidirish, savat, savdo va chek chiqarish ochiq.</p>
          </div>
          <div className="p-3 border-t border-stone-800">
            <div className="mb-2 rounded-xl bg-stone-900 px-3 py-2"><div className="text-[10px] text-stone-500">Bugungi tushum</div><div className="font-mono font-black text-amber-300">{formatMoney(todayRevenue)}</div></div>
            <button type="button" onClick={onLockAdmin} className="w-full rounded-xl border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-stone-900">Hisobdan chiqish</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Main Left Column (Sidebar) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-stone-950 text-white border-r border-stone-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top Branding Section */}
        <div className="p-4 border-b border-stone-800/90 bg-gradient-to-b from-stone-900 to-stone-950 flex items-center justify-between shrink-0">
          <div 
            onClick={() => handleTabClick('chiqim')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center font-black text-stone-950 shadow-md group-hover:scale-105 transition-transform shrink-0">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white uppercase truncate">
                  {storeInfo.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider truncate">
                  Aksessuarlar & POS
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Action POS Button */}
        <div className="p-3 border-b border-stone-800/60 bg-stone-950 shrink-0">
          <button
            type="button"
            onClick={() => handleTabClick('chiqim')}
            className={`w-full py-3 px-3.5 rounded-xl font-black text-xs flex items-center justify-between transition-all cursor-pointer shadow-sm ${
              activeTab === 'chiqim'
                ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-300'
                : 'bg-stone-900 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                activeTab === 'chiqim' ? 'bg-stone-950 text-amber-400' : 'bg-amber-400 text-stone-950'
              }`}>
                🛒
              </div>
              <span className="text-sm">POS Kassa (Sotuv)</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'chiqim' ? 'bg-stone-950/20 text-stone-950' : 'bg-stone-800 text-stone-300'
            }`}>
              F2
            </span>
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 text-xs font-medium">
          {/* Group 1: Savdo & Ombor */}
          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-black text-stone-300 uppercase tracking-wider">
              Asosiy Bo'limlar
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleTabClick('chiqim')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'chiqim')}`}
              >
                <div className="flex items-center gap-2.5">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span>Sotuv (Kassa)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('kirim')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'kirim')}`}
              >
                <div className="flex items-center gap-2.5">
                  <ArrowDownLeft className="w-4 h-4 text-sky-400" />
                  <span>Tovar Kirim Qilish</span>
                </div>
                <span className="text-[10px] font-mono bg-stone-800 px-1 rounded text-stone-400">F3</span>
              </button>

              {onOpenPhotoKirim && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenPhotoKirim();
                    onCloseMobile();
                  }}
                  className="w-full px-3 py-1.5 rounded-xl flex items-center justify-between text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 border border-amber-400/30 transition-all cursor-pointer text-[11px] font-bold"
                  title="Nakladnoy yoki daftardagi ro'yxatni rasmga olib avtomatik kirim qilish"
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>📸 AI Foto Kirim</span>
                  </div>
                  <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded text-[9px] font-mono border border-amber-400/30">
                    Gemini
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleTabClick('stock')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'stock')}`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Ombor & Qoldiqlar</span>
                </div>
                {outOfStockCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                    {outOfStockCount} ta 0 qolgan
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('journal')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'journal')}`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-stone-400" />
                  <span>Harakatlar Jurnali</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              {/* AI Business Analyst & Procurement Advisor */}
              <button
                type="button"
                onClick={() => handleTabClick('ai-analyst')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === 'ai-analyst'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black shadow-md border border-amber-300'
                    : 'text-amber-300 hover:text-white hover:bg-stone-900 border border-amber-400/30 bg-amber-400/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold">AI Tahlilchi & Xarid</span>
                </div>
                {!isAdminUnlocked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                    activeTab === 'ai-analyst' ? 'bg-stone-950 text-amber-400' : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  }`}>
                    TG + AI
                  </span>
                )}
              </button>

              {/* Telegram Mini App & Online Orders */}
              <button
                type="button"
                onClick={() => handleTabClick('telegram-orders')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === 'telegram-orders'
                    ? 'bg-sky-500 text-white font-black shadow-md border border-sky-400'
                    : 'text-sky-300 hover:text-white hover:bg-stone-900 border border-sky-500/30 bg-sky-500/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-bold">Telegram Mini App</span>
                </div>
                {unprintedOrdersCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {unprintedOrdersCount} yangi
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    Kassa
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Group 2: Hisobotlar & PDF Zakaz */}
          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-black text-stone-300 uppercase tracking-wider">
              Hisobot & Buyurtma (PDF)
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleTabClick('report')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'report', !isAdminUnlocked)}`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Kunlik Hisobot & Foyda</span>
                </div>
                {!isAdminUnlocked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>

              {/* DIRECT 1-CLICK ZAKAZ PDF BUTTON */}
              <button
                type="button"
                onClick={() => {
                  onOpenPdfReports('out_of_stock');
                  onCloseMobile();
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-stone-900 border border-amber-400/40 hover:border-amber-400 text-amber-300 hover:text-white flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                    📋
                  </div>
                  <div className="text-left">
                    <span className="font-black text-amber-200 block text-xs">Zakaz Berish (PDF)</span>
                    <span className="text-[10px] text-stone-400 block font-normal">Ta'minotchiga (Narxsiz)</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold text-[10px] border border-amber-400/30">
                  A4
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenPdfReports('daily_sales');
                  onCloseMobile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-stone-300 hover:text-white hover:bg-stone-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Kunlik Savdo PDF</span>
                </div>
                <span className="text-[10px] font-mono text-stone-500">PDF</span>
              </button>
            </div>
          </div>

          {/* Group 3: Qarzlar & Dilerlar */}
          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-black text-stone-300 uppercase tracking-wider">
              Nasiya & Ta'minotchilar
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleTabClick('debts')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'debts')}`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Mijoz Nasiyalari</span>
                </div>
                {activeDebtsCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950 font-mono">
                    {activeDebtsCount} ta
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('supplier-debts')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'supplier-debts', !isAdminUnlocked)}`}
              >
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-rose-400" />
                  <span>Ta'minotchi Qarzlarimiz</span>
                </div>
                {!isAdminUnlocked ? (
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                ) : activeSupplierDebtsCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {activeSupplierDebtsCount} ta
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>
            </div>
          </div>

          {/* Group 4: Qo'shimcha Asboblar & Sozlamalar */}
          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-black text-stone-300 uppercase tracking-wider">
              Sozlamalar & Amallar
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleTabClick('hisobchi')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${navItemClass(activeTab === 'hisobchi', !isAdminUnlocked)}`}
              >
                <div className="flex items-center gap-2.5">
                  <Calculator className="w-4 h-4 text-purple-400" />
                  <span>Do'kon Sozlamalari</span>
                </div>
                {!isAdminUnlocked ? <Lock className="w-3.5 h-3.5 text-stone-500" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenVazvrat();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-stone-300 hover:text-white hover:bg-stone-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Tovar Qaytarish (Vazvrat)</span>
                </div>
                <span className="text-[10px] font-mono text-stone-500">Qabul</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenExcelImport();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-stone-300 hover:text-white hover:bg-stone-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Excel / CSV Import</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">+Baza</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenInstallModal();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-amber-300 hover:text-white hover:bg-stone-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-amber-400" />
                  <span>Рабочий столga o'rnatish</span>
                </div>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">PC</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenApiModal?.();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-cyan-300 hover:text-white hover:bg-stone-900 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Code2 className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
                  <span>REST API (1C / Bot)</span>
                </div>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold px-1.5 py-0.5 rounded font-mono">
                  v1.0
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Status Card: Today's Revenue & Admin Toggle */}
        <div className="p-3 border-t border-stone-800 bg-stone-900/90 shrink-0 space-y-2.5">
          {/* Revenue mini box */}
          <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase">Bugungi Savdo Tushumi</div>
              <div className="text-sm font-black text-amber-300 font-mono mt-0.5">
                {formatMoney(todayRevenue)}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-black text-xs">
              UZS
            </div>
          </div>

          {/* Admin Lock / Unlock Toggle */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-stone-400">
              {isAdminUnlocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold text-[11px]">Rahbar Rejimi</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-stone-400 text-[11px]">Kassir Rejimi</span>
                </>
              )}
            </div>

            {isAdminUnlocked ? (
              <button
                type="button"
                onClick={onLockAdmin}
                className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold cursor-pointer transition-colors"
                title="PIN-kod bilan qayta qulflash"
              >
                Qulflash
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequireAdminPin()}
                className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-stone-950 text-[11px] font-black cursor-pointer transition-colors flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                <span>PIN-kod</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
