import React, { useState, useMemo } from 'react';
import { DebtRecord, PaymentMethod, StockMovement, StoreSettings } from '../types';
import { DebtPeriodReport } from './DebtPeriodReport';
import { downloadDebtStatementPdf, printDebtStatement } from '../utils/debtStatementActions';
import { DebtStatementParams, toLocalDay } from '../utils/debtStatementReceipt';
import { STORE_INFO } from '../data/initialData';
import { activeCustomerDebtReport, customerDebtTotal, debtOverdueDays, groupDebtsByCustomer } from '../utils/saleAccounting';
import { formatMoney, formatDate, downloadCSV } from '../utils/formatters';
import { 
  BookOpen, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  DollarSign, 
  Download, 
  Phone, 
  Send,
  X,
  CreditCard,
  FileText,
  Printer
} from 'lucide-react';

interface DebtsViewProps {
  debts: DebtRecord[];
  movements: StockMovement[];
  storeInfo?: StoreSettings;
  onAddDebtPayment: (debtId: string, amount: number, method: 'naqd' | 'click_payme') => void;
  onAddNewDebt: (debt: DebtRecord) => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  debts,
  movements,
  storeInfo,
  onAddDebtPayment,
  onAddNewDebt
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'barchasi' | 'faol' | 'yopildi'>('faol');
  const [sortBy, setSortBy] = useState<'muddat' | 'summa' | 'yangi'>('muddat');
  const [viewMode, setViewMode] = useState<'qarzlar' | 'mijozlar' | 'davr'>('qarzlar');
  
  // Payment modal state
  const [paymentModalDebt, setPaymentModalDebt] = useState<DebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'naqd' | 'click_payme'>('naqd');

  // Manual add debt modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDebtData, setNewDebtData] = useState({
    customerName: '',
    customerPhone: '+998 ',
    totalDebt: 100000,
    paidAmount: 0,
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    notes: ''
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Metrics
  const totalRemainingDebt = debts
    .filter((d) => d.status !== 'yopildi')
    .reduce((sum, d) => sum + d.remainingAmount, 0);

  const totalCollectedDebt = debts.reduce((sum, d) => sum + d.paidAmount, 0);
  const activeDebtorsCount = debts.filter((d) => d.status !== 'yopildi').length;
  const overdueDebts = debts.filter((d) => debtOverdueDays(d) > 0);
  const overdueTotal = overdueDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const customerSummaries = useMemo(() => groupDebtsByCustomer(debts), [debts]);

  // Filter debts
  const filteredDebts = useMemo(() => {
    const list = debts.filter((d) => {
      if (statusFilter === 'faol' && d.status === 'yopildi') return false;
      if (statusFilter === 'yopildi' && d.status !== 'yopildi') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.customerName.toLowerCase().includes(q) ||
          d.customerPhone.toLowerCase().includes(q) ||
          (d.notes && d.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
    const sorted = [...list];
    if (sortBy === 'summa') sorted.sort((a, b) => b.remainingAmount - a.remainingAmount);
    else if (sortBy === 'yangi') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => (a.status === 'yopildi' ? 1 : 0) - (b.status === 'yopildi' ? 1 : 0) || a.dueDate.localeCompare(b.dueDate));
    return sorted;
  }, [debts, statusFilter, searchQuery, sortBy]);

  const handleOpenPayment = (debt: DebtRecord) => {
    setPaymentModalDebt(debt);
    setPayAmount(debt.remainingAmount);
    setPayMethod('naqd');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt || payAmount <= 0) return;

    onAddDebtPayment(paymentModalDebt.id, payAmount, payMethod);
    setPaymentModalDebt(null);
  };

  /** Mijozning hozirgi barcha faol nasiyalari bo'yicha PDF/chek uchun ma'lumot. */
  const buildStatement = (debt: DebtRecord): DebtStatementParams | null => {
    const customer = activeCustomerDebtReport(debts, movements, debt);
    if (!customer) return null;
    return {
      customer,
      store: storeInfo ?? STORE_INFO,
      from: toLocalDay(customer.rows[0].debt.createdAt),
      to: toLocalDay(new Date()),
      totalDebt: customer.remaining
    };
  };

  const handleStatementPdf = (debt: DebtRecord) => {
    const params = buildStatement(debt);
    if (params) downloadDebtStatementPdf(params);
  };

  const handleStatementPrint = (debt: DebtRecord) => {
    const params = buildStatement(debt);
    if (params) void printDebtStatement(params);
  };

  const handleCopyReminder = (debt: DebtRecord) => {
    const customerTotal = customerDebtTotal(debts, debt.customerName, debt.customerPhone);
    const totalLine = customerTotal > debt.remainingAmount ? ` Umumiy qarzdorligingiz: ${formatMoney(customerTotal)}.` : '';
    const text = `Assalomu alaykum, ${debt.customerName}! ${STORE_INFO.name} do'konidan olingan mahsulotlar bo'yicha ${formatMoney(debt.remainingAmount)} miqdoridagi nasiya to'lovini eslatib o'tamiz.${totalLine} To'lov muddati: ${debt.dueDate}. Murojaat uchun: ${STORE_INFO.phone}`;
    navigator.clipboard.writeText(text);
    setCopiedId(debt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = [
      'Mijoz ismi',
      'Telefon',
      'Jami nasiya summasi',
      'To\'langan summa',
      'Qarz qoldig\'i',
      'To\'lash muddati',
      'Holati',
      'Izoh'
    ];

    const rows = debts.map((d) => [
      d.customerName,
      d.customerPhone,
      d.totalDebt.toString(),
      d.paidAmount.toString(),
      d.remainingAmount.toString(),
      d.dueDate,
      d.status,
      d.notes || ''
    ]);

    downloadCSV(`Paxtaobod_Beeline_Nasiya_${new Date().toISOString().slice(0, 10)}.csv`, [
      headers,
      ...rows
    ]);
  };

  const handleCreateManualDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebtData.customerName.trim() || newDebtData.totalDebt <= 0) {
      alert('Mijoz ismi va nasiya summasini kiriting!');
      return;
    }

    const remaining = Math.max(0, newDebtData.totalDebt - newDebtData.paidAmount);
    const newRecord: DebtRecord = {
      id: `debt-${Date.now()}`,
      movementId: `manual-${Date.now()}`,
      customerName: newDebtData.customerName.trim(),
      customerPhone: newDebtData.customerPhone.trim(),
      totalDebt: Number(newDebtData.totalDebt),
      paidAmount: Number(newDebtData.paidAmount),
      remainingAmount: remaining,
      dueDate: newDebtData.dueDate,
      createdAt: new Date().toISOString(),
      status: remaining === 0 ? 'yopildi' : newDebtData.paidAmount > 0 ? 'qisman_tolandi' : 'faol',
      notes: newDebtData.notes.trim() || 'Qo\'lda kiritilgan nasiya',
      paymentHistory: newDebtData.paidAmount > 0 ? [
        {
          date: new Date().toISOString(),
          amount: Number(newDebtData.paidAmount),
          method: 'naqd'
        }
      ] : []
    };

    onAddNewDebt(newRecord);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="flex justify-between items-center text-stone-500 text-xs font-bold uppercase">
            <span>Kutilayotgan Nasiya Qoldig'i</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-600 mt-2">
            {formatMoney(totalRemainingDebt)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {activeDebtorsCount} nafar mijozning qarz summasi
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="flex justify-between items-center text-stone-500 text-xs font-bold uppercase">
            <span>Qaytarilgan / To'langan Qarzlar</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 mt-2">
            {formatMoney(totalCollectedDebt)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Muvaffaqiyatli undirilgan tushum
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="flex justify-between items-center text-stone-500 text-xs font-bold uppercase">
            <span>Muddati o'tgan qarzlar</span>
            <BookOpen className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-red-600 mt-2">
            {formatMoney(overdueTotal)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {overdueDebts.length} ta qarz, {customerSummaries.length} ta mijoz faol qarzda
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Mijoz ismi, telefoni..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('faol')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'faol' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700'
              }`}
            >
              Faol qarzlar
            </button>
            <button
              onClick={() => setStatusFilter('yopildi')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'yopildi' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700'
              }`}
            >
              Yopilganlar
            </button>
            <button
              onClick={() => setStatusFilter('barchasi')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'barchasi' ? 'bg-amber-400 text-stone-950 shadow-xs' : 'text-stone-700'
              }`}
            >
              Barchasi
            </button>
          </div>

          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('qarzlar')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${viewMode === 'qarzlar' ? 'bg-stone-950 text-white' : 'text-stone-700'}`}
            >
              Qarzlar
            </button>
            <button
              onClick={() => setViewMode('mijozlar')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${viewMode === 'mijozlar' ? 'bg-stone-950 text-white' : 'text-stone-700'}`}
            >
              Mijozlar bo'yicha
            </button>
            <button
              onClick={() => setViewMode('davr')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${viewMode === 'davr' ? 'bg-stone-950 text-white' : 'text-stone-700'}`}
            >
              Kunlar oralig'i
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'muddat' | 'summa' | 'yangi')}
            className="px-2.5 py-1.5 bg-stone-100 text-stone-800 text-xs font-bold rounded-xl cursor-pointer focus:outline-none"
            aria-label="Saralash"
          >
            <option value="muddat">Muddat bo'yicha</option>
            <option value="summa">Summa bo'yicha</option>
            <option value="yangi">Yangilari avval</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi Nasiya Yozish</span>
          </button>
        </div>
      </div>

      {viewMode === 'davr' && <DebtPeriodReport debts={debts} movements={movements} store={storeInfo ?? STORE_INFO} query={searchQuery} />}

      {viewMode === 'mijozlar' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Mijoz</th>
                  <th className="py-3 px-4">Telefon</th>
                  <th className="py-3 px-4 text-center">Faol qarzlar</th>
                  <th className="py-3 px-4 text-right">Jami qoldiq</th>
                  <th className="py-3 px-4">Eng yaqin muddat</th>
                  <th className="py-3 px-4">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customerSummaries.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-stone-400">Faol qarzi bor mijoz yo'q</td></tr>
                ) : (
                  customerSummaries
                    .filter((c) => !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery.trim()))
                    .map((c) => (
                      <tr key={c.key} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-bold text-stone-900">{c.name}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{c.phone}</td>
                        <td className="py-3 px-4 text-center">{c.activeCount}</td>
                        <td className="py-3 px-4 text-right font-black text-red-600 whitespace-nowrap">{formatMoney(c.remaining)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{c.nearestDue || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {c.maxOverdueDays > 0 ? (
                            <span className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded">{c.maxOverdueDays} kun kechikdi</span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded">Muddatida</span>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'qarzlar' && (<>
      {/* Mobile Debt Cards List (Telefonda Nasiya Kartalari) */}
      <div className="md:hidden space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
            Nasiya ma'lumotlari topilmadi
          </div>
        ) : (
          filteredDebts.map((debt) => {
            const isClosed = debt.status === 'yopildi';
            const isOverdue = !isClosed && new Date(debt.dueDate).getTime() < Date.now();
            const percentPaid = Math.min(
              100,
              Math.round((debt.paidAmount / (debt.totalDebt || 1)) * 100)
            );

            return (
              <div
                key={debt.id}
                className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 ${
                  isOverdue
                    ? 'border-red-300 bg-red-50/10'
                    : isClosed
                    ? 'border-stone-200 opacity-80'
                    : 'border-stone-200'
                }`}
              >
                {/* Header: Customer Name, Phone & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-sm text-stone-900 leading-tight">
                      {debt.customerName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={`tel:${debt.customerPhone}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg transition-colors"
                      >
                        <Phone className="w-3 h-3 text-amber-600" />
                        <span>{debt.customerPhone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isClosed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Yopildi</span>
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        <span>{debtOverdueDays(debt)} kun kechikdi</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>Ochiq</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Jami nasiya:</span>
                    <span className="font-semibold text-stone-800">{formatMoney(debt.totalDebt)}</span>
                  </div>
                  <div className="flex justify-between items-center text-stone-600">
                    <span>To'langan:</span>
                    <span className="font-semibold text-emerald-700">{formatMoney(debt.paidAmount)} ({percentPaid}%)</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-stone-200">
                    <span className="font-bold text-stone-900">Qoldiq qarz:</span>
                    <span className="font-black text-sm text-red-600">
                      {formatMoney(debt.remainingAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-red-700 border-t border-stone-200 pt-1">
                    <span>Mijozning jami qarzi:</span>
                    <span>{formatMoney(customerDebtTotal(debts, debt.customerName, debt.customerPhone) || (debt.customerName === "Do'kon mijozi" ? debt.remainingAmount : 0))}</span>
                  </div>
                </div>

                {/* Due Date & Notes */}
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Muddat: <strong className={isOverdue ? 'text-red-600' : 'text-stone-700'}>{debt.dueDate}</strong></span>
                  {debt.notes && (
                    <span className="truncate max-w-[160px] text-stone-400">"{debt.notes}"</span>
                  )}
                </div>

                {/* Actions Row */}
                {!isClosed && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatementPdf(debt)}
                      className="flex-1 py-2 px-3 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => handleStatementPrint(debt)}
                      className="flex-1 py-2 px-3 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Chek</span>
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                  {!isClosed ? (
                    <button
                      onClick={() => handleOpenPayment(debt)}
                      className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                      <span>To'lov Qabul Qilish</span>
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl">
                      To'liq to'langan
                    </div>
                  )}

                  <button
                    onClick={() => handleCopyReminder(debt)}
                    className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                    title="Eslatma matnini olish"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedId === debt.id ? "Nusxalandi!" : "Eslatma"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Debts Table (Desktop Screens) */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Mijoz</th>
                <th className="py-3 px-4">Telefon</th>
                <th className="py-3 px-4 text-right">Jami Nasiya</th>
                <th className="py-3 px-4 text-right">To'langan</th>
                <th className="py-3 px-4 text-right">Qoldiq Qarz</th>
                <th className="py-3 px-4">To'lov muddati</th>
                <th className="py-3 px-4">Holati</th>
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    Nasiya ma'lumotlari topilmadi
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => {
                  const isClosed = debt.status === 'yopildi';
                  const isOverdue = !isClosed && new Date(debt.dueDate).getTime() < Date.now();

                  return (
                    <tr key={debt.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-stone-900">
                        {debt.customerName}
                        {debt.notes && (
                          <div className="text-[10px] text-stone-400 font-normal">
                            {debt.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-stone-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{debt.customerPhone}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-stone-900 whitespace-nowrap">
                        {formatMoney(debt.totalDebt)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatMoney(debt.paidAmount)}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-amber-600 whitespace-nowrap">
                        {formatMoney(debt.remainingAmount)}
                        <div className="text-[10px] text-red-700">Mijoz jami: {formatMoney(customerDebtTotal(debts, debt.customerName, debt.customerPhone) || (debt.customerName === "Do'kon mijozi" ? debt.remainingAmount : 0))}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-stone-400'}`} />
                          <span className={isOverdue ? 'text-red-600 font-bold' : 'text-stone-700'}>
                            {debt.dueDate}
                          </span>
                        </div>
                        {isOverdue && (
                          <span className="text-[9px] text-red-600 font-bold uppercase tracking-wider">
                            {debtOverdueDays(debt)} kun kechikdi
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isClosed ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded">
                            To'liq to'landi
                          </span>
                        ) : debt.paidAmount > 0 ? (
                          <span className="bg-blue-100 text-blue-800 font-bold text-[10px] px-2 py-0.5 rounded">
                            Qisman to'langan
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded">
                            Kutilmoqda
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!isClosed && (
                            <button
                              onClick={() => handleOpenPayment(debt)}
                              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            >
                              To'lov olish
                            </button>
                          )}
                          <button
                            onClick={() => handleCopyReminder(debt)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Eslatma matnidan nusxa olish"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {!isClosed && (
                            <>
                              <button
                                onClick={() => handleStatementPdf(debt)}
                                className="px-2 py-1 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                title="Mijozga eslatish uchun PDF (barcha faol nasiyalari)"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                PDF
                              </button>
                              <button
                                onClick={() => handleStatementPrint(debt)}
                                className="px-2 py-1 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                title="80 mm chek (barcha faol nasiyalari)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Chek
                              </button>
                            </>
                          )}
                          {copiedId === debt.id && (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Nusxa olindi!
                            </span>
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

      </>)}

      {/* Payment Acceptance Modal */}
      {paymentModalDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Qarz to'lovini qabul qilish</h3>
              <button
                onClick={() => setPaymentModalDebt(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <div className="font-bold text-stone-900">{paymentModalDebt.customerName}</div>
                <div className="text-stone-500">Qarz qoldig'i:</div>
                <div className="text-lg font-black text-amber-600">
                  {formatMoney(paymentModalDebt.remainingAmount)}
                </div>
              </div>

              {paymentModalDebt.paymentHistory && paymentModalDebt.paymentHistory.length > 0 && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="font-semibold text-stone-700">To'lovlar tarixi</div>
                  {paymentModalDebt.paymentHistory.map((p, i) => (
                    <div key={i} className="flex justify-between text-stone-600">
                      <span>{formatDate(p.date)} · {p.method === 'naqd' ? 'Naqd' : 'Click / Payme'}</span>
                      <span className="font-bold text-emerald-700">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  To'lanayotgan summa (so'm) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={paymentModalDebt.remainingAmount}
                  step="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 -mt-1">
                <button type="button" onClick={() => setPayAmount(paymentModalDebt.remainingAmount)} className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg font-bold text-stone-700 cursor-pointer">To'liq</button>
                <button type="button" onClick={() => setPayAmount(Math.floor(paymentModalDebt.remainingAmount / 2))} className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg font-bold text-stone-700 cursor-pointer">Yarmi</button>
                <span className="ml-auto text-stone-500">
                  Qoladi: <strong className="text-red-600">{formatMoney(Math.max(0, paymentModalDebt.remainingAmount - (payAmount || 0)))}</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  To'lov usuli:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('naqd')}
                    className={`py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                      payMethod === 'naqd'
                        ? 'bg-stone-950 text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    Naqd pul
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('click_payme')}
                    className={`py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                      payMethod === 'click_payme'
                        ? 'bg-stone-950 text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    Click / Payme
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  To'lovni tasdiqlash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModalDebt(null)}
                  className="px-4 py-2.5 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Debt Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Yangi Nasiya Qo'shish</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualDebt} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Mijoz to'liq ismi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Sardorbek Usta"
                  value={newDebtData.customerName}
                  onChange={(e) => setNewDebtData({ ...newDebtData, customerName: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Telefon raqami *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+998 90 123 45 67"
                  value={newDebtData.customerPhone}
                  onChange={(e) => setNewDebtData({ ...newDebtData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Umumiy nasiya summasi *
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={newDebtData.totalDebt}
                    onChange={(e) => setNewDebtData({ ...newDebtData, totalDebt: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Boshlang'ich to'langan
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newDebtData.paidAmount}
                    onChange={(e) => setNewDebtData({ ...newDebtData, paidAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  To'lash muddati
                </label>
                <input
                  type="date"
                  value={newDebtData.dueDate}
                  onChange={(e) => setNewDebtData({ ...newDebtData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Nasiyaga olingan aksessuarlar / Izoh
                </label>
                <textarea
                  rows={2}
                  placeholder="Masalan: 1 ta Remax 20W blok va 1 ta bron oyna olgan"
                  value={newDebtData.notes}
                  onChange={(e) => setNewDebtData({ ...newDebtData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Nasiyani saqlash
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
