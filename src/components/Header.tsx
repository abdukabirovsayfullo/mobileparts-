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
  ExternalLink,
  Truck,
  Calculator,
  Lock,
  ShieldCheck,
  KeyRound,
  RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import { STORE_INFO } from '../data/initialData';
import { StoreSettings } from '../types';

export type AccountingTab = 'report' | 'kirim' | 'chiqim' | 'journal' | 'stock' | 'debts' | 'supplier-debts' | 'hisobchi' | 'ai-analyst' | 'telegram-orders' | 'customers';

interface HeaderProps {
  activeTab: AccountingTab;
  setActiveTab: (tab: AccountingTab) => void;
  todayRevenue: number;
  activeDebtsCount: number;
  activeSupplierDebtsCount?: number;
  storeInfo?: StoreSettings;
  isAdminUnlocked?: boolean;
  onRequireAdminPin?: (targetTab?: AccountingTab) => void;
  onLockAdmin?: () => void;
  onQuickKirim: () => void;
  onQuickChiqim: () => void;
  onOpenVazvrat?: () => void;
  onOpenExcelImport?: () => void;
  onOpenPdfReports?: (reportType?: any) => void;
  onOpenInstallModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  todayRevenue,
  activeDebtsCount,
  activeSupplierDebtsCount = 0,
  storeInfo = STORE_INFO,
  isAdminUnlocked = false,
  onRequireAdminPin,
  onLockAdmin,
  onQuickKirim,
  onQuickChiqim,
  onOpenVazvrat,
  onOpenExcelImport,
  onOpenPdfReports,
  onOpenInstallModal
}) => {
  const currentStore = storeInfo || STORE_INFO;

  const handleTabClick = (tab: AccountingTab) => {
    const protectedTabs: AccountingTab[] = ['report', 'supplier-debts', 'hisobchi'];
    if (protectedTabs.includes(tab) && !isAdminUnlocked) {
      if (onRequireAdminPin) {
        onRequireAdminPin(tab);
      }
      return;
    }
    setActiveTab(tab);
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-950 text-white border-b border-stone-800 shadow-md">
      {/* Top micro summary bar */}
      <div className="hidden md:flex items-center justify-between px-6 py-1.5 bg-stone-900 text-[11px] text-stone-400 border-b border-stone-800/80">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-stone-200 font-bold">{currentStore.name} - Buxgalteriya & Savdo Tizimi</span>
          </div>
          <span className="text-stone-600">|</span>
          <span>Mas'ul: {currentStore.accountantName}</span>
          <span className="text-stone-600">|</span>
          <span className="text-stone-400">{currentStore.phone}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-stone-300">
            <span>Bugungi savdo:</span>
            <span className="font-bold text-white">{formatMoney(todayRevenue)}</span>
          </div>

          {activeDebtsCount > 0 && (
            <div className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-400/30 flex items-center gap-1">
              <span>Mijozlar qarzi: {activeDebtsCount} ta</span>
            </div>
          )}

          {isAdminUnlocked ? (
            activeSupplierDebtsCount > 0 && (
              <div className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[11px] font-bold border border-red-500/30 flex items-center gap-1">
                <span>Ta'minotchi qarzi: {activeSupplierDebtsCount} ta</span>
              </div>
            )
          ) : (
            <div 
              onClick={() => onRequireAdminPin && onRequireAdminPin('supplier-debts')}
              className="bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-300 px-2 py-0.5 rounded text-[11px] font-bold border border-stone-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Ta'minotchi qarzlarini ko'rish uchun PIN-kod kiriting"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Ta'minotchi qarzi: Maxfiy</span>
            </div>
          )}
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Desktop Header Layout */}
        <div className="hidden lg:flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => handleTabClick('report')}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center font-black text-stone-950 shadow-md group-hover:scale-105 transition-transform">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white uppercase">
                  {currentStore.name}
                </span>
                <span className="bg-amber-400 text-stone-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase">
                  POS
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-medium truncate max-w-[220px]">
                {currentStore.address}
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1 bg-stone-900/90 p-1.5 rounded-xl border border-stone-800 text-xs">
            <button
              id="tab-report"
              onClick={() => handleTabClick('report')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Kunlik Foyda</span>
              {!isAdminUnlocked && (
                <Lock className="w-3 h-3 text-amber-400 ml-0.5" />
              )}
            </button>

            <button
              id="tab-kirim"
              onClick={() => handleTabClick('kirim')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'kirim'
                  ? 'bg-emerald-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tovar Kirimi</span>
            </button>

            <button
              id="tab-chiqim"
              onClick={() => handleTabClick('chiqim')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'chiqim'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-300" />
              <span>Tovar Chiqimi (Sotuv)</span>
            </button>

            <button
              id="tab-journal"
              onClick={() => handleTabClick('journal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'journal'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Kirim-Chiqim Jurnali</span>
            </button>

            <button
              id="tab-stock"
              onClick={() => handleTabClick('stock')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Ombor Qoldig'i</span>
            </button>

            <button
              id="tab-debts"
              onClick={() => handleTabClick('debts')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'debts'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Nasiya</span>
              {activeDebtsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 text-[10px] font-black rounded-full">
                  {activeDebtsCount}
                </span>
              )}
            </button>

            <button
              id="tab-supplier-debts"
              onClick={() => handleTabClick('supplier-debts')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'supplier-debts'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-red-400" />
              <span>Ta'minotchi Qarzi</span>
              {activeSupplierDebtsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {activeSupplierDebtsCount}
                </span>
              )}
              {!isAdminUnlocked && (
                <Lock className="w-3 h-3 text-amber-400 ml-0.5" />
              )}
            </button>

            <button
              id="tab-hisobchi"
              onClick={() => handleTabClick('hisobchi')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'hisobchi'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-amber-400 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Hisobchi Paneli</span>
              {!isAdminUnlocked && (
                <Lock className="w-3 h-3 text-amber-400 ml-0.5" />
              )}
            </button>
          </nav>

          {/* Quick Add & Install Actions */}
          <div className="flex items-center gap-2">
            {/* Admin PIN Lock/Unlock Status Toggle Button */}
            {isAdminUnlocked ? (
              <div className="flex items-center gap-1 bg-stone-900 border border-emerald-500/50 p-1 rounded-xl shadow-xs">
                <span className="px-2 py-1 text-emerald-400 font-bold text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Rahbar</span>
                </span>
                <button
                  onClick={onLockAdmin}
                  className="px-2 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="Qulflash (Kassir rejimiga o'tish)"
                >
                  <Lock className="w-3 h-3 text-red-400" />
                  <span>Qulflash</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onRequireAdminPin && onRequireAdminPin()}
                className="px-2.5 py-1.5 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Foydalar va ta'minotchi qarzlarini ko'rish uchun PIN-kodni kiriting"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Rahbar PIN</span>
              </button>
            )}

            <button
              onClick={onOpenInstallModal}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Kompyuter yoki telefon ekraniga o'rnatish qo'llanmasi"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>O'rnatish</span>
            </button>

            {onOpenPdfReports && (
              <button
                onClick={() => onOpenPdfReports()}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Rasmiy Rangli PDF Hisobotlar (Zakaz, Savdo, Ombor, Qarzlar)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">PDF Hisobot</span>
                <span className="xl:hidden">PDF</span>
              </button>
            )}

            {onOpenExcelImport && (
              <button
                onClick={onOpenExcelImport}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Excel / CSV orqali tovar yuklash"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Excel Kirim</span>
              </button>
            )}

            <button
              onClick={onQuickKirim}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Yangi tovar keldi (Kirim)"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Kirim</span>
            </button>

            <button
              onClick={onQuickChiqim}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Tovar sotildi (Chiqim)"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              <span>- Chiqim (Sotuv)</span>
            </button>

            {onOpenVazvrat && (
              <button
                onClick={onOpenVazvrat}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Mijozdan tovar qaytarish (Vazvrat)"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xl:inline">Vazvrat</span>
                <span className="xl:hidden">↩</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Header Layout (Sleek, Compact, High-Density for Phones) */}
        <div className="lg:hidden flex items-center justify-between h-13 py-2">
          {/* Mobile Logo & Active View Badge */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center font-black text-stone-950 shadow-sm shrink-0">
              <Smartphone className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1">
                <span className="font-black text-xs text-white uppercase tracking-tight">
                  Paxtaobod Beeline
                </span>
                <span className="bg-amber-400 text-stone-950 font-black text-[9px] px-1 rounded uppercase">
                  POS
                </span>
              </div>
              <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <span>
                  {activeTab === 'chiqim' && '🛒 Kassa (Sotuv)'}
                  {activeTab === 'kirim' && '📥 Tovar Kirimi'}
                  {activeTab === 'stock' && '📦 Ombor Qoldig\'i'}
                  {activeTab === 'debts' && `📒 Nasiya (${activeDebtsCount})`}
                  {activeTab === 'report' && '📊 Kunlik Foyda'}
                  {activeTab === 'journal' && '📋 Harakatlar Jurnali'}
                  {activeTab === 'supplier-debts' && `🚚 Ta'minotchi Qarzi (${activeSupplierDebtsCount})`}
                  {activeTab === 'hisobchi' && '🧮 Hisobchi Paneli'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Right Controls: Vazvrat + PDF + Admin PIN + Install */}
          <div className="flex items-center gap-1.5">
            {onOpenPdfReports && (
              <button
                onClick={() => onOpenPdfReports()}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs"
                title="PDF Hisobotlar"
              >
                <FileText className="w-3 h-3 stroke-[2.5]" />
                <span>PDF</span>
              </button>
            )}

            {onOpenVazvrat && (
              <button
                onClick={onOpenVazvrat}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs"
                title="Tovar qaytarish (Vazvrat)"
              >
                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                <span>Vazvrat</span>
              </button>
            )}

            {isAdminUnlocked ? (
              <button
                onClick={onLockAdmin}
                className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Rahbar rejimi ochiq (Qulflash uchun bosing)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rahbar</span>
                <Lock className="w-3 h-3 text-red-400 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={() => onRequireAdminPin && onRequireAdminPin()}
                className="px-2 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="PIN-kodni kiritish"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Rahbar PIN</span>
              </button>
            )}

            <button
              onClick={onOpenInstallModal}
              className="p-1.5 bg-stone-900 text-stone-300 hover:text-white border border-stone-800 rounded-lg text-xs cursor-pointer"
              title="Telefonga o'rnatish"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

