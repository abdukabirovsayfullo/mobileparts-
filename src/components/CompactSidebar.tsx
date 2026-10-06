import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Box,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileSpreadsheet,
  PackagePlus,
  Settings,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Undo2,
  UserRound,
  Users,
  X
} from 'lucide-react';
import type { StoreSettings } from '../types';
import type { AccountingTab } from './Header';
import type { PdfReportType } from './PdfReportModal';

interface Props {
  activeTab: AccountingTab;
  setActiveTab: (tab: AccountingTab) => void;
  storeInfo: StoreSettings;
  isAdminUnlocked: boolean;
  onLockAdmin: () => void;
  onOpenVazvrat: () => void;
  onOpenExcelImport: () => void;
  onOpenPdfReports: (type?: PdfReportType) => void;
  onOpenInstallModal: () => void;
  onOpenPhotoKirim?: () => void;
  onOpenApiModal?: () => void;
  activeDebtsCount: number;
  activeSupplierDebtsCount: number;
  outOfStockCount: number;
  unprintedOrdersCount: number;
  collapsed?: boolean;
  onCollapse?: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const navButtonClass = (isActive: boolean) =>
  `w-full rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm font-bold ${
    isActive ? 'bg-amber-400 text-stone-950' : 'text-stone-300 hover:bg-stone-900'
  }`;

const extraButtonClass = 'w-full px-3 py-2 text-left text-xs text-stone-400 hover:text-stone-200 flex items-center gap-2';

const Badge: React.FC<{ count: number; tone: 'alert' | 'info' }> = ({ count, tone }) =>
  count > 0 ? (
    <span
      className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black font-mono ${
        tone === 'alert' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-stone-950'
      }`}
    >
      {count}
    </span>
  ) : null;

export const CompactSidebar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  storeInfo,
  isAdminUnlocked,
  onLockAdmin,
  onOpenVazvrat,
  onOpenExcelImport,
  onOpenPdfReports,
  onOpenInstallModal,
  onOpenPhotoKirim,
  onOpenApiModal,
  activeDebtsCount,
  activeSupplierDebtsCount,
  outOfStockCount,
  unprintedOrdersCount,
  collapsed,
  onCollapse,
  isMobileOpen,
  onCloseMobile
}) => {
  const go = (tab: AccountingTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const runAndClose = (action: () => void) => () => {
    action();
    onCloseMobile();
  };

  const navItem = (tab: AccountingTab, label: string, Icon: LucideIcon, badge?: React.ReactNode) => (
    <button type="button" onClick={() => go(tab)} className={navButtonClass(activeTab === tab)}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
      {badge}
    </button>
  );

  const asideClass = `fixed inset-y-0 left-0 z-50 w-64 bg-stone-950 text-white border-r border-stone-800 flex flex-col transition-transform ${
    collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'
  } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`;

  if (!isAdminUnlocked) {
    return (
      <aside className={`${asideClass} p-3`}>
        <div className="flex items-center justify-between p-2">
          <strong>{storeInfo.name}</strong>
          <button
            type="button"
            title="Menyuni yig'ish"
            onClick={() => {
              onCloseMobile();
              if (window.innerWidth >= 1024) onCollapse?.();
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {navItem('chiqim', 'Sotuv va qidiruv', ShoppingCart)}
        {navItem('customers', 'Doimiy mijozlar', Users)}
        {navItem('debts', 'Nasiya', BookOpen)}
        <button
          type="button"
          onClick={runAndClose(onOpenVazvrat)}
          className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm font-bold text-stone-300 hover:bg-stone-900"
        >
          <Undo2 className="w-4 h-4" />
          Tovar qaytarish
        </button>
        <button
          type="button"
          onClick={onLockAdmin}
          className="absolute bottom-4 left-3 right-3 rounded-xl border border-stone-700 py-2 text-xs"
        >
          Hisobdan chiqish
        </button>
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      <div className="h-16 px-4 flex items-center gap-3 border-b border-stone-800">
        <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm truncate">{storeInfo.name}</strong>
          <span className="text-[10px] text-stone-400">VPS SERVER</span>
        </div>
        <button type="button" onClick={onCloseMobile} className="lg:hidden">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItem('chiqim', 'Sotuv kassasi', ShoppingCart)}
        {navItem('customers', 'Doimiy mijozlar', Users)}
        {navItem('kirim', 'Tovar kirimi', PackagePlus)}
        {navItem('stock', 'Ombor', Box, <Badge count={outOfStockCount} tone="alert" />)}
        {navItem('debts', 'Mijoz nasiyalari', BookOpen, <Badge count={activeDebtsCount} tone="info" />)}
        {navItem('supplier-debts', 'Ta’minotchi qarzi', CircleDollarSign, <Badge count={activeSupplierDebtsCount} tone="info" />)}
        {navItem('telegram-orders', 'Telegram zakazlar', Smartphone, <Badge count={unprintedOrdersCount} tone="alert" />)}
        {navItem('report', 'Hisobotlar', BarChart3)}
        {navItem('hisobchi', 'Sozlamalar', Settings)}

        <details className="pt-2 group">
          <summary className="list-none cursor-pointer rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm font-bold text-stone-400 hover:bg-stone-900">
            <ChevronDown className="w-4 h-4 group-open:rotate-180" />
            Qo‘shimcha
          </summary>
          <div className="mt-1 pl-2 space-y-1 border-l border-stone-800">
            {navItem('journal', 'Harakatlar jurnali', BookOpen)}
            {navItem('ai-analyst', 'AI tahlilchi', Sparkles)}
            <button type="button" onClick={runAndClose(() => onOpenPdfReports('out_of_stock'))} className={extraButtonClass}>
              <ClipboardList className="w-4 h-4" />
              Zakaz berish (PDF)
            </button>
            <button type="button" onClick={runAndClose(() => onOpenPdfReports())} className={extraButtonClass}>
              📄 PDF hisobotlar
            </button>
            <button type="button" onClick={runAndClose(onOpenVazvrat)} className={extraButtonClass}>
              <Undo2 className="w-4 h-4" />
              Tovar qaytarish
            </button>
            {onOpenPhotoKirim && (
              <button type="button" onClick={runAndClose(onOpenPhotoKirim)} className={extraButtonClass}>
                📸 Foto kirim
              </button>
            )}
            <button type="button" onClick={runAndClose(onOpenExcelImport)} className={extraButtonClass}>
              <FileSpreadsheet className="w-4 h-4" />
              Excel import
            </button>
            <button type="button" onClick={runAndClose(onOpenInstallModal)} className={extraButtonClass}>
              💻 Ilovani o‘rnatish
            </button>
            {onOpenApiModal && (
              <button type="button" onClick={runAndClose(onOpenApiModal)} className={extraButtonClass}>
                API integratsiya
              </button>
            )}
          </div>
        </details>
      </nav>

      <div className="p-3 border-t border-stone-800">
        <div className="rounded-xl bg-stone-900 px-3 py-2 flex items-center gap-2 text-xs">
          <UserRound className="w-4 h-4 text-amber-400" />
          <span className="flex-1">Rahbar</span>
          <button type="button" onClick={onLockAdmin} className="text-stone-400">
            Chiqish
          </button>
        </div>
      </div>
    </aside>
  );
};
