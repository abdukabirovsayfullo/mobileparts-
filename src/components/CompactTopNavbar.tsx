import React from 'react';
import { Camera, ClipboardList, Menu, UserRound } from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import type { AccountingTab } from './Header';
import type { PdfReportType } from './PdfReportModal';

const tabNames: Record<AccountingTab, string> = {
  chiqim: 'Sotuv kassasi',
  kirim: 'Tovar kirimi',
  stock: 'Ombor va qoldiqlar',
  report: 'Hisobotlar',
  debts: 'Mijoz nasiyalari',
  'supplier-debts': 'Ta’minotchi qarzlari',
  journal: 'Harakatlar jurnali',
  hisobchi: 'Sozlamalar',
  'ai-analyst': 'AI tahlilchi',
  'telegram-orders': 'Telegram zakazlar',
  customers: 'Doimiy mijozlar'
};

interface Props {
  activeTab: AccountingTab;
  onOpenMobileMenu: () => void;
  todayRevenue: number;
  outOfStockCount: number;
  isAdminUnlocked: boolean;
  onLockAdmin: () => void;
  onOpenPhotoKirim?: () => void;
  onOpenPdfReports: (type?: PdfReportType) => void;
}

export const CompactTopNavbar: React.FC<Props> = ({
  activeTab,
  onOpenMobileMenu,
  todayRevenue,
  outOfStockCount,
  isAdminUnlocked,
  onLockAdmin,
  onOpenPhotoKirim,
  onOpenPdfReports
}) => (
  <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b flex items-center px-3 sm:px-6 gap-3">
    <button
      type="button"
      onClick={onOpenMobileMenu}
      className="lg:hidden w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
    >
      <Menu className="w-4 h-4" />
    </button>

    <div className="flex-1 min-w-0">
      <h1 className="font-black text-base truncate">{tabNames[activeTab]}</h1>
      <p className="text-[10px] text-stone-500">MOBILE PARTS • VPS</p>
    </div>

    {isAdminUnlocked && (
      <div className="hidden md:flex items-center gap-2">
        {onOpenPhotoKirim && (
          <button
            type="button"
            onClick={onOpenPhotoKirim}
            title="Nakladnoy yoki daftarni rasmga olib kirim qilish"
            className="rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 px-3 py-2 text-xs font-black flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" />
            Foto kirim
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenPdfReports('out_of_stock')}
          title="Ta’minotchi uchun narxsiz zakaz varaqasi"
          className="rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 px-3 py-2 text-xs font-black flex items-center gap-1.5"
        >
          <ClipboardList className="w-4 h-4" />
          Zakaz
          {outOfStockCount > 0 && (
            <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.5 text-[10px] font-mono">{outOfStockCount}</span>
          )}
        </button>
      </div>
    )}

    <div className="hidden sm:block text-right">
      <div className="text-[9px] text-stone-500">Bugungi tushum</div>
      <strong className="text-sm">{formatMoney(todayRevenue)}</strong>
    </div>

    <button
      type="button"
      onClick={onLockAdmin}
      className="rounded-xl bg-stone-950 text-white px-3 py-2 text-xs font-bold flex gap-1.5"
    >
      <UserRound className="w-4 h-4" />
      {isAdminUnlocked ? 'Rahbar' : 'Ishchi'}
    </button>
  </header>
);
