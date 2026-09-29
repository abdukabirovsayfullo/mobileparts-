import React, { useState, useMemo } from 'react';
import { StockMovement, Product } from '../types';
import { formatMoney, formatDate, downloadCSV } from '../utils/formatters';
import { 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  CreditCard, 
  BookOpen, 
  Calendar, 
  Download, 
  Printer, 
  CheckCircle2, 
  Sparkles,
  PackageCheck,
  AlertCircle,
  MapPin,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  RotateCcw,
  FileText
} from 'lucide-react';

interface DailyReportViewProps {
  movements: StockMovement[];
  products: Product[];
  onNavigateToKirim: () => void;
  onNavigateToChiqim: () => void;
  onPrintReceipt?: (movement: StockMovement) => void;
  onOpenPdfReports?: (reportType?: 'daily_sales') => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  movements,
  products,
  onNavigateToKirim,
  onNavigateToChiqim,
  onPrintReceipt,
  onOpenPdfReports
}) => {
  // Period filter
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));
  // Privacy mask toggle (hides numbers if someone approaches)
  const [isProfitMasked, setIsProfitMasked] = useState<boolean>(false);

  const renderProfit = (amount: number) => {
    if (isProfitMasked) return '••••••';
    return `+${formatMoney(amount)}`;
  };

  // Compute date range
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return movements.filter((m) => {
      const itemDate = m.timestamp.slice(0, 10);

      if (selectedPeriod === 'today') {
        return itemDate === todayStr;
      }
      if (selectedPeriod === 'yesterday') {
        return itemDate === yesterdayStr;
      }
      if (selectedPeriod === 'week') {
        return new Date(m.timestamp) >= sevenDaysAgo;
      }
      if (selectedPeriod === 'month') {
        return new Date(m.timestamp) >= firstDayOfMonth;
      }
      if (selectedPeriod === 'custom') {
        return itemDate === customDate;
      }
      return true;
    });
  }, [movements, selectedPeriod, customDate]);

  // Separate Kirim, Chiqim, and Vazvrat
  const kirimList = filteredMovements.filter((m) => m.type === 'kirim');
  const chiqimList = filteredMovements.filter((m) => m.type === 'chiqim');
  const vazvratList = filteredMovements.filter((m) => m.type === 'vazvrat');

  // Key Financial Metrics
  // 1. Kirim totals
  const totalKirimSum = kirimList.reduce((sum, m) => sum + m.totalCost, 0);
  const totalKirimQty = kirimList.reduce((sum, m) => sum + m.quantity, 0);

  // 2. Chiqim (Sotuv) totals
  const grossChiqimRevenue = chiqimList.reduce((sum, m) => sum + m.totalRevenue, 0);
  const grossChiqimCost = chiqimList.reduce((sum, m) => sum + m.totalCost, 0);
  const totalChiqimQty = chiqimList.reduce((sum, m) => sum + m.quantity, 0);

  // 3. Vazvrat (Qaytarilgan tovarlar) totals
  const totalVazvratRevenue = vazvratList.reduce((sum, m) => sum + m.totalRevenue, 0);
  const totalVazvratCost = vazvratList.reduce((sum, m) => sum + m.totalCost, 0);
  const totalVazvratQty = vazvratList.reduce((sum, m) => sum + m.quantity, 0);
  const totalVazvratProfit = totalVazvratRevenue - totalVazvratCost;

  // 4. Net figures (Sof Tushum va Sof Foyda)
  const totalChiqimRevenue = Math.max(0, grossChiqimRevenue - totalVazvratRevenue);
  const totalChiqimCost = Math.max(0, grossChiqimCost - totalVazvratCost);
  const totalProfit = (grossChiqimRevenue - grossChiqimCost) - totalVazvratProfit;
  const profitMargin = totalChiqimRevenue > 0 ? ((totalProfit / totalChiqimRevenue) * 100).toFixed(1) : '0';

  // 5. Payment breakdown (deducting refunded cash/card)
  const cashRefund = vazvratList
    .filter((m) => m.paymentMethod === 'naqd')
    .reduce((sum, m) => sum + m.totalRevenue, 0);

  const clickRefund = vazvratList
    .filter((m) => m.paymentMethod === 'click_payme' || m.paymentMethod === 'uzum')
    .reduce((sum, m) => sum + m.totalRevenue, 0);

  const cashRevenue = Math.max(0, chiqimList
    .filter((m) => m.paymentMethod === 'naqd')
    .reduce((sum, m) => sum + m.totalRevenue, 0) - cashRefund);

  const clickRevenue = Math.max(0, chiqimList
    .filter((m) => m.paymentMethod === 'click_payme' || m.paymentMethod === 'uzum')
    .reduce((sum, m) => sum + m.totalRevenue, 0) - clickRefund);

  const debtRevenue = chiqimList
    .filter((m) => m.paymentMethod === 'nasiya')
    .reduce((sum, m) => sum + m.totalRevenue, 0);

  // Warehouse current total valuation
  const warehouseTotalStockValue = products.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);
  const warehouseTotalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0);
  const warehouseExpectedProfit = warehouseTotalRetailValue - warehouseTotalStockValue;

  // Most profitable products in selected period
  const topProfitProducts = useMemo(() => {
    const map: { [name: string]: { qty: number; profit: number; revenue: number } } = {};
    chiqimList.forEach((m) => {
      if (!map[m.productName]) {
        map[m.productName] = { qty: 0, profit: 0, revenue: 0 };
      }
      map[m.productName].qty += m.quantity;
      map[m.productName].profit += m.profit;
      map[m.productName].revenue += m.totalRevenue;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [chiqimList]);

  // Export Daily Report to CSV
  const handleExportReportCSV = () => {
    const summaryRows = [
      ['PAXTAOBOD BEELINE - KUNLIK MOLIYAVIY HISOBOT'],
      ['Sana / Davr:', selectedPeriod.toUpperCase()],
      ['Hisoblangan vaqt:', new Date().toLocaleString('uz-UZ')],
      [''],
      ['KO\'RSATKICH', 'QIYMAT'],
      ['Kunlik Sof Foyda', totalProfit.toString()],
      ['Jami Tushum (Sotuv / Chiqim)', totalChiqimRevenue.toString()],
      ['Sotilgan tovarlar tan narxi', totalChiqimCost.toString()],
      ['Foyda marjasi (%)', `${profitMargin}%`],
      ['Sotilgan tovarlar soni (dona)', totalChiqimQty.toString()],
      ['Omborga kiritilgan tovar summasi (Kirim)', totalKirimSum.toString()],
      ['Omborga kiritilgan tovar soni', totalKirimQty.toString()],
      ['Naqd pul tushumi', cashRevenue.toString()],
      ['Click / Payme tushumi', clickRevenue.toString()],
      ['Nasiyaga berilgan', debtRevenue.toString()],
      [''],
      ['CHIQGAN (SOTILGAN) TOVARLAR TAFSILOTI'],
      ['Vaqt', 'Tovar nomi', 'Kategoriya', 'Soni', 'Tan narx', 'Sotish narx', 'Jami tushum', 'Sof Foyda', 'To\'lov turi', 'Mijoz']
    ];

    const chiqimRows = chiqimList.map((m) => [
      formatDate(m.timestamp),
      m.productName,
      m.category,
      m.quantity.toString(),
      m.unitCost.toString(),
      m.unitPrice.toString(),
      m.totalRevenue.toString(),
      m.profit.toString(),
      m.paymentMethod || 'naqd',
      m.counterparty
    ]);

    const kirimHeader = [
      [''],
      ['KIRGAN (QABUL QILINGAN) TOVARLAR TAFSILOTI'],
      ['Vaqt', 'Tovar nomi', 'Kategoriya', 'Soni', 'Tan narx', 'Jami Kirim Qiymati', 'Ta\'minotchi', 'Izoh']
    ];

    const kirimRows = kirimList.map((m) => [
      formatDate(m.timestamp),
      m.productName,
      m.category,
      m.quantity.toString(),
      m.unitCost.toString(),
      m.totalCost.toString(),
      m.counterparty,
      m.notes || ''
    ]);

    const allRows = [...summaryRows, ...chiqimRows, ...kirimHeader, ...kirimRows];
    downloadCSV(`Paxtaobod_Beeline_Kunlik_Hisobot_${selectedPeriod}.csv`, allRows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Confidential Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 text-white p-4 sm:p-5 rounded-2xl border border-stone-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Maxfiy Moliyaviy Bo'lim (Faqat Rahbar Uchun)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1.5 text-white tracking-tight">
            Kunlik Sof Foyda &amp; Moliyaviy Hisobot
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Barcha sof foyda, tushum va marjalar faqat ushbu sahifada jamlangan. Begonalar ko'rmaydi.
          </p>
        </div>
      </div>

      {/* Top Filter & Actions */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1.5 rounded-xl text-xs font-bold">
          <button
            onClick={() => setSelectedPeriod('today')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedPeriod === 'today' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700 hover:text-stone-950'
            }`}
          >
            Bugun
          </button>
          <button
            onClick={() => setSelectedPeriod('yesterday')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedPeriod === 'yesterday' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700 hover:text-stone-950'
            }`}
          >
            Kecha
          </button>
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedPeriod === 'week' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700 hover:text-stone-950'
            }`}
          >
            7 kun
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedPeriod === 'month' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700 hover:text-stone-950'
            }`}
          >
            Shu oy
          </button>
          <button
            onClick={() => setSelectedPeriod('custom')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedPeriod === 'custom' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700 hover:text-stone-950'
            }`}
          >
            Sana tanlash
          </button>
        </div>

        {/* If Custom Date */}
        {selectedPeriod === 'custom' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Privacy Eye Toggle */}
          <button
            type="button"
            onClick={() => setIsProfitMasked(!isProfitMasked)}
            className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              isProfitMasked
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
            title={isProfitMasked ? "Foyda raqamlarini ko'rsatish" : "Foydani berkitish (begonalar ko'rmasligi uchun)"}
          >
            {isProfitMasked ? (
              <>
                <Eye className="w-4 h-4 text-amber-700" />
                <span>Foydani Ko'rsatish</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-stone-600" />
                <span>Foydani Berkitish</span>
              </>
            )}
          </button>

          {onOpenPdfReports && (
            <button
              type="button"
              onClick={() => onOpenPdfReports('daily_sales')}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Kunlik savdo va kassa hisobotini rangli grafikali PDF qilish"
            >
              <FileText className="w-4 h-4 text-stone-950" />
              <span>📄 Savdo PDF</span>
            </button>
          )}

          <button
            onClick={handleExportReportCSV}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Excel formatida hisobotni yuklash"
          >
            <Download className="w-4 h-4 text-stone-600" />
            <span>Excel Hisobot</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Hisobotni printerga chiqarish"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Chop etish</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. SOF FOYDA (The most important KPI) */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Kunlik Sof Foyda</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2 tracking-tight">
            {renderProfit(totalProfit)}
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
            <span>Foyda marjasi:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {isProfitMasked ? '••%' : `${profitMargin}%`}
            </span>
          </div>
        </div>

        {/* 2. CHIQIM / SOTUV (Oborot) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Jami Tovar Chiqimi (Sotuv)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 mt-2 tracking-tight">
            {formatMoney(totalChiqimRevenue)}
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
            <span>Sotilgan tovarlar:</span>
            <span className="font-bold text-stone-800">{totalChiqimQty} dona</span>
          </div>
        </div>

        {/* 3. KIRIM (Omborga tovar kirdi) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Jami Tovar Kirimi (Qabul)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2 tracking-tight">
            {formatMoney(totalKirimSum)}
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
            <span>Kiritilgan tovarlar:</span>
            <span className="font-bold text-stone-800">{totalKirimQty} dona</span>
          </div>
        </div>

        {/* 4. TAN NARXI (Sotilgan tovar tannarxi) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Sotilgan Tovar Tan Narxi</span>
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-700 mt-2 tracking-tight">
            {formatMoney(totalChiqimCost)}
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
            <span>Sof tushum asosi:</span>
            <span className="font-bold text-stone-600">Sotuv - Tannarx</span>
          </div>
        </div>

        {/* 5. VAZVRAT (Qaytarilgan tovarlar) */}
        {totalVazvratQty > 0 && (
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-xs sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-rose-800">
                  Ushbu davrda mijozlar qaytargan tovarlar (Vazvrat)
                </div>
                <div className="text-xs text-rose-900/80 mt-0.5">
                  Jami <strong>{totalVazvratQty} dona</strong> tovar qaytarilgan va <strong>{formatMoney(totalVazvratRevenue)} so'm</strong> pul qaytarilgan (Sof tushum va foydadan chegirildi)
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-rose-700">
                -{formatMoney(totalVazvratRevenue)}
              </div>
              <div className="text-[10px] text-rose-800 font-bold uppercase">
                Qaytarilgan summa
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment methods breakdown */}
      <div className="bg-stone-900 text-white rounded-2xl p-5 border border-stone-800 shadow-sm">
        <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" />
          <span>To'lov Turlari Bo'yicha Tushum Taqsimoti:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800">
            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Naqd pul tushumi</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {formatMoney(cashRevenue)}
            </div>
          </div>

          <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800">
            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Click / Payme tushumi</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {formatMoney(clickRevenue)}
            </div>
          </div>

          <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800">
            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Nasiya (Qarzga sotilgan)</span>
            </div>
            <div className="text-lg font-black text-amber-400 mt-1">
              {formatMoney(debtRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Tovar Kirdi vs Tovar Chiqdi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Tovar Kirimi (Qaysi tovar kirdi?) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                ↓
              </div>
              <h3 className="font-black text-sm text-stone-900">
                Qaysi Tovar Kirdi? (Kirim / Prikhod)
              </h3>
            </div>
            <button
              onClick={onNavigateToKirim}
              className="text-xs text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
            >
              + Yangi Kirim
            </button>
          </div>

          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {kirimList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                Ushbu davrda omborga tovar kiritilmagan.
              </div>
            ) : (
              kirimList.map((item) => (
                <div key={item.id} className="p-3.5 hover:bg-stone-50/70 transition-colors text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-stone-900">
                      {item.productName}
                    </span>
                    <span className="font-black text-blue-700 whitespace-nowrap">
                      +{item.quantity} dona
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-500 text-[11px]">
                    <span>Tan narxi: {formatMoney(item.unitCost)} / dona</span>
                    <span className="font-bold text-stone-900">
                      Jami: {formatMoney(item.totalCost)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                    <span>Manba: {item.counterparty}</span>
                    <span>{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Tovar Chiqimi (Qaysi tovar chiqdi / sotildi?) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                ↑
              </div>
              <h3 className="font-black text-sm text-stone-900">
                Qaysi Tovar Chiqdi? (Sotuv / Rasxod)
              </h3>
            </div>
            <button
              onClick={onNavigateToChiqim}
              className="text-xs text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
            >
              + Yangi Chiqim (Sotuv)
            </button>
          </div>

          <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {chiqimList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                Ushbu davrda tovar sotilmagan.
              </div>
            ) : (
              chiqimList.map((item) => (
                <div key={item.id} className="p-3.5 hover:bg-stone-50/70 transition-colors text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-stone-900">
                      {item.productName}
                    </span>
                    <span className="font-black text-stone-900 whitespace-nowrap">
                      {item.quantity} dona × {formatMoney(item.unitPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-500 text-[11px]">
                    <span>Tan narx: {formatMoney(item.unitCost)}</span>
                    <span className="font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Foyda: {renderProfit(item.profit)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-100">
                    <div className="space-y-0.5">
                      <div className="font-bold text-stone-800">
                        {item.counterparty} ({item.paymentMethod?.toUpperCase() || 'NAQD'})
                      </div>
                      {item.customerAddress && (
                        <div className="text-stone-400 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[200px]">{item.customerAddress}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400">{formatDate(item.timestamp)}</span>
                      {onPrintReceipt && (
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(item)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-400 text-stone-800 hover:text-stone-950 font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-amber-200"
                          title="Chekni printerdan chiqarish"
                        >
                          <Printer className="w-3 h-3 text-amber-800" />
                          <span>Chek</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Vazvrat (Qaytarilgan Tovarlar) List if any */}
      {vazvratList.length > 0 && (
        <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-rose-50/70 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center font-bold text-xs">
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-sm text-rose-950">
                Qaytarilgan Tovarlar (Vazvrat Ro'yxati)
              </h3>
            </div>
            <span className="text-xs font-black text-rose-700 bg-white px-2.5 py-1 rounded-xl border border-rose-200">
              Jami: {totalVazvratQty} dona • -{formatMoney(totalVazvratRevenue)} so'm
            </span>
          </div>

          <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
            {vazvratList.map((item) => (
              <div key={item.id} className="p-3.5 hover:bg-rose-50/20 transition-colors text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-stone-900">
                    {item.productName}
                  </span>
                  <span className="font-black text-rose-700 whitespace-nowrap">
                    {item.quantity} dona × {formatMoney(item.unitPrice)} = -{formatMoney(item.totalRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-stone-500 text-[11px]">
                  <span>Mijoz: <strong className="text-stone-800">{item.counterparty}</strong></span>
                  {item.returnReason && (
                    <span className="font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                      Sabab: {item.returnReason}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                  <span>Qaytarish usuli: {item.paymentMethod?.toUpperCase()}</span>
                  <span>{formatDate(item.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Profitable Products Ranking */}
      {topProfitProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Eng Ko'p Sof Foyda Keltirgan Aksessuarlar (Top-5)</span>
            </h3>
            <span className="text-xs text-stone-400">Foyda bo'yicha saralangan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {topProfitProducts.map((p, idx) => (
              <div
                key={idx}
                className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-stone-900 truncate">
                    {idx + 1}. {p.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Sotilgan: {p.qty} dona</span>
                  <span className="font-black text-emerald-600">
                    {renderProfit(p.profit)}
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 text-right">
                  Jami tushum: {formatMoney(p.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse Capital Status Overview */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Hozirgi Omborxona Umumiy Balansi (Aksessuarlar kapitali)
          </div>
          <div className="text-xl font-black text-stone-900 mt-1">
            {formatMoney(warehouseTotalStockValue)}{' '}
            <span className="text-xs font-normal text-stone-500">(Tan narxida)</span>
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            Sotilgandagi kutilayotgan umumiy qiymat: <strong className="text-stone-900">{formatMoney(warehouseTotalRetailValue)}</strong> (Kutilayotgan umumiy foyda: {renderProfit(warehouseExpectedProfit)})
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNavigateToKirim}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Tovar Kiritish</span>
          </button>
          <button
            onClick={onNavigateToChiqim}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Tovar Chiqarish (Sotish)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
