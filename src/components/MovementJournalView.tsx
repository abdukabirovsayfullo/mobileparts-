import React, { useState, useMemo } from 'react';
import { StockMovement } from '../types';
import { formatMoney, formatDate, downloadCSV } from '../utils/formatters';
import { 
  FileText, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw,
  Download, 
  Printer, 
  Filter, 
  Calendar, 
  Sparkles,
  MapPin,
  Lock,
  PlusCircle,
  Tag
} from 'lucide-react';

interface MovementJournalViewProps {
  movements: StockMovement[];
  isAdminUnlocked?: boolean;
  onRequireUnlock?: () => void;
  onPrintReceipt?: (movement: StockMovement) => void;
  onOpenVazvrat?: (movement?: StockMovement) => void;
}

export const MovementJournalView: React.FC<MovementJournalViewProps> = ({
  movements,
  isAdminUnlocked = false,
  onRequireUnlock,
  onPrintReceipt,
  onOpenVazvrat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'kirim' | 'chiqim' | 'vazvrat'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return movements.filter((m) => {
      // Type
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;

      // Date
      if (dateFilter === 'today') {
        if (m.timestamp.slice(0, 10) !== todayStr) return false;
      } else if (dateFilter === 'week') {
        if (new Date(m.timestamp) < weekAgo) return false;
      } else if (dateFilter === 'month') {
        if (new Date(m.timestamp) < firstDayMonth) return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.productName.toLowerCase().includes(q) ||
          m.counterparty.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q)) ||
          (m.returnReason && m.returnReason.toLowerCase().includes(q)) ||
          (m.receiptNumber && m.receiptNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, typeFilter, dateFilter, searchQuery]);

  // Totals for filtered records
  const totalKirimCount = filteredMovements.filter((m) => m.type === 'kirim').reduce((s, m) => s + m.quantity, 0);
  const totalKirimSum = filteredMovements.filter((m) => m.type === 'kirim').reduce((s, m) => s + m.totalCost, 0);

  const totalChiqimCount = filteredMovements.filter((m) => m.type === 'chiqim').reduce((s, m) => s + m.quantity, 0);
  const totalChiqimRevenue = filteredMovements.filter((m) => m.type === 'chiqim').reduce((s, m) => s + m.totalRevenue, 0);

  const totalVazvratCount = filteredMovements.filter((m) => m.type === 'vazvrat').reduce((s, m) => s + m.quantity, 0);
  const totalVazvratSum = filteredMovements.filter((m) => m.type === 'vazvrat').reduce((s, m) => s + m.totalRevenue, 0);

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Harakat turi',
      'Sana va vaqt',
      'Tovar nomi',
      'Kategoriya',
      'Miqdori',
      'Tan narxi',
      'Sotish / Qaytarish narxi',
      'Jami summa',
      'To\'lov usuli',
      'Ta\'minotchi / Mijoz',
      'Qaytarish sababi / Izoh'
    ];

    const rows = filteredMovements.map((m) => {
      let typeLabel = 'CHIQIM (Tovar sotildi)';
      if (m.type === 'kirim') typeLabel = 'KIRIM (Tovar kirdi)';
      if (m.type === 'vazvrat') typeLabel = 'VAZVRAT (Mijozdan qaytdi)';

      return [
        m.id,
        typeLabel,
        formatDate(m.timestamp),
        m.productName,
        m.category,
        m.quantity.toString(),
        m.unitCost.toString(),
        m.unitPrice.toString(),
        (m.type === 'kirim' ? m.totalCost : m.totalRevenue).toString(),
        m.paymentMethod || '-',
        m.counterparty,
        m.returnReason ? `${m.returnReason} | ${m.notes || ''}` : (m.notes || '')
      ];
    });

    downloadCSV(`Paxtaobod_Beeline_Kirim_Chiqim_Jurnali_${new Date().toISOString().slice(0, 10)}.csv`, [
      headers,
      ...rows
    ]);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Mini Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Kirim */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase flex items-center justify-between">
            <span>Kirim (Kirdi)</span>
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 mt-2 truncate">
            {formatMoney(totalKirimSum)}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {totalKirimCount} dona qabul qilingan
          </div>
        </div>

        {/* Chiqim (Sotuv) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase flex items-center justify-between">
            <span>Chiqim (Sotuv)</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 mt-2 truncate">
            {formatMoney(totalChiqimRevenue)}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {totalChiqimCount} dona sotilgan
          </div>
        </div>

        {/* Vazvrat (Qaytarilgan) */}
        <div className="bg-white rounded-2xl border border-rose-200 p-4 sm:p-5 shadow-xs bg-rose-50/20">
          <div className="text-[11px] font-bold text-rose-700 uppercase flex items-center justify-between">
            <span>Vazvrat (Qaytarildi)</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 mt-2 truncate">
            {formatMoney(totalVazvratSum)}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-0.5">
            {totalVazvratCount} dona tovar qaytgan
          </div>
        </div>

        {/* Jami operatsiyalar */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs">
          <div className="text-[11px] font-bold text-stone-600 uppercase flex items-center justify-between">
            <span>Jami Operatsiyalar</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 mt-2">
            {filteredMovements.length} ta
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Filtr bo'yicha yozuvlar
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Quick Action & Filters */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Quick Vazvrat button */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Tovar nomi, mijoz, chek raqami..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {onOpenVazvrat && (
            <button
              type="button"
              onClick={() => onOpenVazvrat()}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Mijozdan tovar qaytarish (vazvrat)"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Tovar Qaytarish</span>
              <span className="sm:hidden">Vazvrat</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                typeFilter === 'all' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700'
              }`}
            >
              Barchasi
            </button>
            <button
              onClick={() => setTypeFilter('kirim')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                typeFilter === 'kirim' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-700'
              }`}
            >
              Kirim
            </button>
            <button
              onClick={() => setTypeFilter('chiqim')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                typeFilter === 'chiqim' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700'
              }`}
            >
              Sotuv
            </button>
            <button
              onClick={() => setTypeFilter('vazvrat')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                typeFilter === 'vazvrat' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Vazvrat
            </button>
          </div>

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none"
          >
            <option value="all">Barcha vaqt</option>
            <option value="today">Bugun</option>
            <option value="week">Oxirgi 7 kun</option>
            <option value="month">Shu oy</option>
          </select>

          {/* Export */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel Jurnal</span>
          </button>
        </div>
      </div>

      {/* MOBILE CARDS VIEW (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filteredMovements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
            Harakatlar topilmadi
          </div>
        ) : (
          filteredMovements.map((m) => {
            const isKirim = m.type === 'kirim';
            const isVazvrat = m.type === 'vazvrat';

            return (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 ${
                  isVazvrat
                    ? 'border-rose-200 bg-rose-50/10'
                    : isKirim
                    ? 'border-blue-100'
                    : 'border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isVazvrat ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px]">
                        <RotateCcw className="w-3 h-3 text-rose-600" />
                        <span>VAZVRAT</span>
                      </span>
                    ) : isKirim ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200">
                        <ArrowDownLeft className="w-3 h-3" />
                        <span>KIRIM</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 font-bold text-[10px] border border-amber-300">
                        <ArrowUpRight className="w-3 h-3 text-amber-700" />
                        <span>SOTUV</span>
                      </span>
                    )}

                    <span className="text-[10px] text-stone-400">
                      {formatDate(m.timestamp)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-black ${isVazvrat ? 'text-rose-600' : 'text-stone-950'}`}>
                      {isKirim ? formatMoney(m.totalCost) : isVazvrat ? `-${formatMoney(m.totalRevenue)}` : formatMoney(m.totalRevenue)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="font-black text-stone-900 text-sm">{m.productName}</div>
                  <div className="text-[11px] text-stone-500 flex items-center justify-between mt-1">
                    <span>
                      {m.category} • <strong className="text-stone-900">{m.quantity} dona</strong>
                    </span>
                    <span className="font-semibold text-stone-700">
                      {formatMoney(m.unitPrice)}/dona
                    </span>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl p-2.5 text-[11px] text-stone-700 flex items-center justify-between">
                  <div className="truncate">
                    <span className="text-stone-400">{isKirim ? "Ta'minotchi:" : "Mijoz:"}</span>{' '}
                    <strong className="text-stone-900">{m.counterparty}</strong>
                  </div>
                  {m.paymentMethod && (
                    <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[10px] uppercase font-bold text-stone-600">
                      {m.paymentMethod}
                    </span>
                  )}
                </div>

                {m.returnReason && (
                  <div className="text-[11px] bg-rose-50 text-rose-800 p-2 rounded-xl border border-rose-200 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Sabab: <strong>{m.returnReason}</strong></span>
                  </div>
                )}

                {/* Mobile Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                  {!isKirim && !isVazvrat && onOpenVazvrat && (
                    <button
                      type="button"
                      onClick={() => onOpenVazvrat(m)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer border border-rose-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Vazvrat qilish</span>
                    </button>
                  )}

                  {onPrintReceipt && (
                    <button
                      type="button"
                      onClick={() => onPrintReceipt(m)}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      <span>{isVazvrat ? 'Vazvrat Cheki' : 'Chek'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP MOVEMENTS TABLE (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Harakat</th>
                <th className="py-3 px-4">Sana va Vaqt</th>
                <th className="py-3 px-4">Tovar Nomi</th>
                <th className="py-3 px-4 text-center">Miqdor</th>
                <th className="py-3 px-4 text-right">
                  {isAdminUnlocked ? (
                    <span>Tan Narxi</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequireUnlock}
                      className="inline-flex items-center gap-1 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer font-bold"
                      title="Tan narxlarini ko'rish uchun bosing"
                    >
                      <span>Tan Narx</span>
                      <Lock className="w-3 h-3 text-amber-500" />
                    </button>
                  )}
                </th>
                <th className="py-3 px-4 text-right">Sotish / Qaytarish</th>
                <th className="py-3 px-4">Mijoz / Ta'minotchi</th>
                <th className="py-3 px-4">Sabab / Izoh</th>
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-stone-400">
                    Kirim-chiqim yozuvlari topilmadi
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isKirim = m.type === 'kirim';
                  const isVazvrat = m.type === 'vazvrat';

                  return (
                    <tr 
                      key={m.id} 
                      className={`hover:bg-stone-50/80 transition-colors ${
                        isVazvrat ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Movement Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVazvrat ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 font-black text-[11px] border border-rose-300">
                            <RotateCcw className="w-3 h-3 text-rose-600 stroke-[2.5]" />
                            <span>VAZVRAT</span>
                          </span>
                        ) : isKirim ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 font-bold text-[11px] border border-blue-200/60">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>KIRDI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 font-bold text-[11px] border border-amber-300/60">
                            <ArrowUpRight className="w-3 h-3 text-amber-700" />
                            <span>CHIQDI (SOTUV)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-400 whitespace-nowrap">
                        {formatDate(m.timestamp)}
                      </td>

                      <td className="py-3 px-4 font-bold text-stone-900">
                        {m.productName}
                        <div className="text-[10px] text-stone-400 font-normal">
                          {m.category}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span 
                          className={`font-black text-xs ${
                            isVazvrat ? 'text-rose-600' : isKirim ? 'text-blue-700' : 'text-stone-900'
                          }`}
                        >
                          {isVazvrat ? `+${m.quantity} (qaytdi)` : isKirim ? `+${m.quantity}` : `-${m.quantity}`} dona
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right text-stone-600 whitespace-nowrap">
                        {isAdminUnlocked ? (
                          formatMoney(m.unitCost)
                        ) : (
                          <span
                            onClick={onRequireUnlock}
                            className="text-stone-400 font-mono tracking-wider cursor-pointer hover:text-amber-600 transition-colors"
                            title="Tan narxni ko'rish uchun bosing"
                          >
                            ••••••
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                        <span className={isVazvrat ? 'text-rose-600' : 'text-stone-900'}>
                          {isVazvrat
                            ? `-${formatMoney(m.totalRevenue)}`
                            : isKirim
                            ? formatMoney(m.totalCost)
                            : formatMoney(m.totalRevenue)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-stone-700 whitespace-nowrap">
                        <div className="font-bold text-stone-900">{m.counterparty}</div>
                        {m.customerAddress && (
                          <div className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span className="truncate max-w-[130px]">{m.customerAddress}</span>
                          </div>
                        )}
                        {!isKirim && m.paymentMethod && (
                          <div className="text-[10px] text-stone-400 uppercase font-bold mt-0.5">
                            {m.paymentMethod}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-500 text-[11px] max-w-[160px] truncate">
                        {m.returnReason ? (
                          <span className="text-rose-700 font-bold">{m.returnReason}</span>
                        ) : (
                          m.notes || '-'
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* If Chiqim, provide direct return button */}
                          {!isKirim && !isVazvrat && onOpenVazvrat && (
                            <button
                              type="button"
                              onClick={() => onOpenVazvrat(m)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[11px] border border-rose-200"
                              title="Ushbu savdo bo'yicha tovarni qaytarish (vazvrat)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Vazvrat</span>
                            </button>
                          )}

                          {/* Print receipt */}
                          {onPrintReceipt && (
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(m)}
                              className="p-1.5 bg-stone-100 hover:bg-amber-400 text-stone-800 hover:text-stone-950 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                              title={isVazvrat ? 'Vazvrat chekini chiqarish' : 'Chekni chiqarish'}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">{isVazvrat ? 'Chek' : 'Chek'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
