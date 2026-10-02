import React, { useState, useMemo } from 'react';
import { SupplierDebtRecord, SupplierPaymentEntry } from '../types';
import { formatMoney, formatDate, downloadCSV } from '../utils/formatters';
import { 
  Building2, 
  Search, 
  Plus, 
  AlertTriangle, 
  Download, 
  Edit3, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  X, 
  Phone, 
  Receipt,
  Calendar,
  CreditCard,
  Banknote,
  History,
  ArrowDownLeft,
  Truck
} from 'lucide-react';

interface SupplierDebtsViewProps {
  supplierDebts: SupplierDebtRecord[];
  onAddSupplierDebtPayment: (
    debtId: string, 
    amount: number, 
    method: 'naqd' | 'karta' | 'hisob_raqam',
    notes?: string
  ) => void;
  onAddNewSupplierDebt: (newDebt: SupplierDebtRecord) => void;
  onUpdateSupplierDebt?: (updatedDebt: SupplierDebtRecord) => void;
  onDeleteSupplierDebt?: (debtId: string) => void;
  onNavigateToKirim?: () => void;
}

export const SupplierDebtsView: React.FC<SupplierDebtsViewProps> = ({
  supplierDebts,
  onAddSupplierDebtPayment,
  onAddNewSupplierDebt,
  onUpdateSupplierDebt,
  onDeleteSupplierDebt,
  onNavigateToKirim
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'faol' | 'qisman_tolandi' | 'yopildi'>('all');

  // Modal states
  const [payingDebt, setPayingDebt] = useState<SupplierDebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'naqd' | 'karta' | 'hisob_raqam'>('naqd');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [viewHistoryDebt, setViewHistoryDebt] = useState<SupplierDebtRecord | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<SupplierDebtRecord | null>(null);
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierPhone: '',
    productSummary: '',
    totalDebt: 0,
    paidAmount: 0,
    dueDate: '',
    notes: ''
  });

  // Calculate high-level summary metrics
  const totalRemainingDebt = useMemo(() => {
    return supplierDebts
      .filter((d) => d.status !== 'yopildi')
      .reduce((sum, d) => sum + d.remainingAmount, 0);
  }, [supplierDebts]);

  const activeDebtsCount = useMemo(() => {
    return supplierDebts.filter((d) => d.status !== 'yopildi').length;
  }, [supplierDebts]);

  const totalPaidToSuppliers = useMemo(() => {
    return supplierDebts.reduce((sum, d) => sum + d.paidAmount, 0);
  }, [supplierDebts]);

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return supplierDebts.filter((d) => {
      if (d.status === 'yopildi' || !d.dueDate) return false;
      return d.dueDate < today;
    }).length;
  }, [supplierDebts]);

  // Filtered debts list
  const filteredDebts = useMemo(() => {
    return supplierDebts.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.supplierName.toLowerCase().includes(q) ||
          (d.supplierPhone && d.supplierPhone.toLowerCase().includes(q)) ||
          d.productSummary.toLowerCase().includes(q) ||
          (d.notes && d.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [supplierDebts, statusFilter, searchQuery]);

  // Open Payment modal
  const handleOpenPayModal = (debt: SupplierDebtRecord) => {
    setPayingDebt(debt);
    setPaymentAmount(debt.remainingAmount);
    setPaymentMethod('naqd');
    setPaymentNotes('');
  };

  // Submit payment
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt) return;

    if (paymentAmount <= 0) {
      alert("To'lov summasi 0 dan katta bo'lishi kerak!");
      return;
    }

    if (paymentAmount > payingDebt.remainingAmount) {
      alert(`To'lov summasi qarzdan (${formatMoney(payingDebt.remainingAmount)}) oshmasligi kerak!`);
      return;
    }

    onAddSupplierDebtPayment(
      payingDebt.id, 
      paymentAmount, 
      paymentMethod, 
      paymentNotes.trim() || undefined
    );
    setPayingDebt(null);
  };

  // Open Add/Edit modal
  const handleOpenAddModal = () => {
    setEditingDebt(null);
    setFormData({
      supplierName: '',
      supplierPhone: '',
      productSummary: '',
      totalDebt: 0,
      paidAmount: 0,
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (debt: SupplierDebtRecord) => {
    setEditingDebt(debt);
    setFormData({
      supplierName: debt.supplierName,
      supplierPhone: debt.supplierPhone || '',
      productSummary: debt.productSummary,
      totalDebt: debt.totalDebt,
      paidAmount: debt.paidAmount,
      dueDate: debt.dueDate || '',
      notes: debt.notes || ''
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAddEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName.trim()) {
      alert('Ta\'minotchi nomini kiriting!');
      return;
    }
    if (formData.totalDebt <= 0) {
      alert('Jami qarz summasi 0 dan katta bo\'lishi kerak!');
      return;
    }

    const paid = Math.min(formData.totalDebt, Math.max(0, formData.paidAmount));
    const remaining = formData.totalDebt - paid;
    const status: 'faol' | 'qisman_tolandi' | 'yopildi' = 
      remaining === 0 ? 'yopildi' : paid > 0 ? 'qisman_tolandi' : 'faol';

    if (editingDebt) {
      if (onUpdateSupplierDebt) {
        onUpdateSupplierDebt({
          ...editingDebt,
          supplierName: formData.supplierName.trim(),
          supplierPhone: formData.supplierPhone.trim() || undefined,
          productSummary: formData.productSummary.trim() || 'Tovar partiyasi',
          totalDebt: formData.totalDebt,
          paidAmount: paid,
          remainingAmount: remaining,
          dueDate: formData.dueDate || undefined,
          status,
          notes: formData.notes.trim() || undefined
        });
      }
    } else {
      const newDebtRecord: SupplierDebtRecord = {
        id: `supp-debt-${Date.now()}`,
        supplierName: formData.supplierName.trim(),
        supplierPhone: formData.supplierPhone.trim() || undefined,
        productSummary: formData.productSummary.trim() || 'Tovar partiyasi',
        totalDebt: formData.totalDebt,
        paidAmount: paid,
        remainingAmount: remaining,
        dueDate: formData.dueDate || undefined,
        createdAt: new Date().toISOString(),
        status,
        notes: formData.notes.trim() || undefined,
        paymentHistory: paid > 0 ? [
          {
            id: `spay-${Date.now()}`,
            date: new Date().toISOString(),
            amount: paid,
            method: 'naqd',
            notes: 'Boshlang\'ich to\'langan summa'
          }
        ] : []
      };
      onAddNewSupplierDebt(newDebtRecord);
    }

    setIsAddModalOpen(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Ta'minotchi",
      "Telefon",
      "Tovar tavsifi",
      "Jami partiya summasi (so'm)",
      "To'langan summa (so'm)",
      "Qolgan qarzimiz (so'm)",
      "Olingan sana",
      "To'lash muddati",
      "Holati",
      "Izoh"
    ];

    const rows = filteredDebts.map((d) => [
      d.supplierName,
      d.supplierPhone || '-',
      d.productSummary,
      d.totalDebt.toString(),
      d.paidAmount.toString(),
      d.remainingAmount.toString(),
      formatDate(d.createdAt),
      d.dueDate ? formatDate(d.dueDate) : '-',
      d.status === 'yopildi' ? 'Yopilgan' : d.status === 'qisman_tolandi' ? 'Qisman to\'langan' : 'Faol qarz',
      d.notes || '-'
    ]);

    downloadCSV(`Taminotchilar_Qarzi_${new Date().toISOString().slice(0, 10)}.csv`, [
      headers,
      ...rows
    ]);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Context */}
      <div className="bg-stone-900 text-white rounded-3xl p-4 sm:p-8 shadow-lg border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
            <Truck className="w-3.5 h-3.5" />
            <span>Ta'minotchilar Bilan Hisob-Kitob Daftari</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
            Ta'minotchilardan Olingan Qarzlar (Bizning Qarzimiz)
          </h2>
          <p className="hidden sm:block text-xs sm:text-sm text-stone-300 max-w-xl">
            Dilerlar va ulgurji ta'minotchilardan (Abu Saxiy, Malika, Ucell, Beeline optomchilar) nasiyaga olingan tovarlar partiyasi, to'langan summalar va qolgan qarzlar hisobi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {onNavigateToKirim && (
            <button
              onClick={onNavigateToKirim}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Yangi Tovar Kirimi</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Yangi Qarz Kiritish</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Debt Remaining */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-red-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Jami Qarzimiz (Ta'minotchi)</span>
            <Building2 className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-600 mt-2 truncate">
            {formatMoney(totalRemainingDebt)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            Dilerlarga to'lanishi kerak bo'lgan jami summa
          </div>
        </div>

        {/* Active Debts Count */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Faol Partiyalar Soni</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 mt-2">
            {activeDebtsCount} ta ta'minotchi
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            Qarzi hali to'liq yopilmagan
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Ta'minotchiga To'langan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2 truncate">
            {formatMoney(totalPaidToSuppliers)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            Olingan partiyalar uchun to'langan qismi
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Muddati O'tgan</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className={`text-xl sm:text-2xl font-black mt-2 ${overdueCount > 0 ? 'text-orange-600' : 'text-stone-900'}`}>
            {overdueCount} ta partiya
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            {overdueCount > 0 ? "⚠️ Shoshilinch to'lash kerak!" : "Hozircha muddati o'tgan qarz yo'q"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Ta'minotchi nomi, telefon raqami yoki tovar tavsifi bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          {/* Export button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-200 shrink-0"
            title="Excel yuklab olish"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>Excel (CSV)</span>
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100">
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Barchasi ({supplierDebts.length})
            </button>
            <button
              onClick={() => setStatusFilter('faol')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'faol'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-red-700'
              }`}
            >
              To'lanmagan ({supplierDebts.filter((d) => d.status === 'faol').length})
            </button>
            <button
              onClick={() => setStatusFilter('qisman_tolandi')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'qisman_tolandi'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-amber-800'
              }`}
            >
              Qisman to'langan ({supplierDebts.filter((d) => d.status === 'qisman_tolandi').length})
            </button>
            <button
              onClick={() => setStatusFilter('yopildi')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'yopildi'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-emerald-700'
              }`}
            >
              Yopilgan ({supplierDebts.filter((d) => d.status === 'yopildi').length})
            </button>
          </div>

          <div className="text-xs font-bold text-stone-500">
            Topildi: <span className="text-stone-900">{filteredDebts.length}</span> ta
          </div>
        </div>
      </div>

      {/* Debts Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Ta'minotchi (Diler)</th>
                <th className="py-3 px-4">Olingan Tovar / Partiya</th>
                <th className="py-3 px-4 text-center">Olingan Sana</th>
                <th className="py-3 px-4 text-right">Jami Partiya</th>
                <th className="py-3 px-4 text-right">To'langan</th>
                <th className="py-3 px-4 text-right">Qolgan Qarzimiz</th>
                <th className="py-3 px-4 text-center">Muddati</th>
                <th className="py-3 px-4 text-center">Holati</th>
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Truck className="w-8 h-8 text-stone-300" />
                      <div className="font-bold text-sm text-stone-700">
                        Qarz yozuvlari topilmadi
                      </div>
                      <div className="text-xs text-stone-400 max-w-sm">
                        Qidiruv mezonlarini o'zgartiring yoki "+ Yangi Qarz Kiritish" orqali yangi ta'minotchi qarzini kiriting.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((d) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isOverdue = d.status !== 'yopildi' && d.dueDate && d.dueDate < today;
                  const isClosed = d.status === 'yopildi';

                  return (
                    <tr 
                      key={d.id} 
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isOverdue ? 'bg-red-50/30' : isClosed ? 'opacity-70 bg-stone-50/30' : ''
                      }`}
                    >
                      {/* Supplier */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{d.supplierName}</span>
                        </div>
                        {d.supplierPhone && (
                          <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{d.supplierPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Product Summary */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-medium text-stone-900 truncate" title={d.productSummary}>
                          {d.productSummary}
                        </div>
                        {d.notes && (
                          <div className="text-[10px] text-stone-400 truncate" title={d.notes}>
                            {d.notes}
                          </div>
                        )}
                      </td>

                      {/* Date Created */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-stone-500">
                        {formatDate(d.createdAt)}
                      </td>

                      {/* Total Partiya */}
                      <td className="py-3 px-4 text-right font-medium text-stone-700 whitespace-nowrap">
                        {formatMoney(d.totalDebt)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatMoney(d.paidAmount)}
                      </td>

                      {/* Remaining Debt */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isClosed ? (
                          <span className="font-bold text-stone-400 line-through">
                            0 so'm
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-lg font-black text-xs bg-red-100 text-red-700 border border-red-200">
                            {formatMoney(d.remainingAmount)}
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {d.dueDate ? (
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-semibold text-stone-700">
                              {formatDate(d.dueDate)}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] text-red-600 font-black bg-red-100 px-1.5 py-0.2 rounded mt-0.5 animate-pulse">
                                Muddati o'tgan!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isClosed
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'qisman_tolandi'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isClosed
                            ? "To'liq yopildi"
                            : d.status === 'qisman_tolandi'
                            ? "Qisman to'landi"
                            : "Faol qarz"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!isClosed && (
                            <button
                              onClick={() => handleOpenPayModal(d)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Ta'minotchiga qarz to'lash"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>To'lash</span>
                            </button>
                          )}

                          {d.paymentHistory && d.paymentHistory.length > 0 && (
                            <button
                              onClick={() => setViewHistoryDebt(d)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                              title="To'lovlar tarixini ko'rish"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(d)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteSupplierDebt && (
                            <button
                              onClick={() => {
                                if (confirm(`"${d.supplierName}" ga tegishli qarz yozuvini o'chirmoqchimisiz?`)) {
                                  onDeleteSupplierDebt(d.id);
                                }
                              }}
                              className="p-1.5 bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal: Make Payment to Supplier */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Ta'minotchiga Qarz To'lash</h3>
              </div>
              <button
                onClick={() => setPayingDebt(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <div className="text-[11px] text-stone-500">Ta'minotchi:</div>
                <div className="font-bold text-sm text-stone-900">{payingDebt.supplierName}</div>
                <div className="text-[11px] text-stone-500 pt-1 flex justify-between border-t border-stone-200/60 mt-1">
                  <span>Qolgan qarzimiz:</span>
                  <strong className="text-red-600 text-xs font-black">
                    {formatMoney(payingDebt.remainingAmount)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Bugungi to'lanayotgan summa (so'm) *
                </label>
                <input
                  type="number"
                  min="1000"
                  max={payingDebt.remainingAmount}
                  step="1000"
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-stone-50 border-2 border-stone-200 focus:border-emerald-500 rounded-xl text-sm font-black text-stone-900 focus:outline-none"
                />

                {/* Quick amount shortcuts */}
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(payingDebt.remainingAmount)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    To'liq to'lash ({formatMoney(payingDebt.remainingAmount)})
                  </button>
                  {payingDebt.remainingAmount > 100000 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(Math.round(payingDebt.remainingAmount / 2 / 1000) * 1000)}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      50% to'lash
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  To'lov usuli *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('naqd')}
                    className={`py-2 px-2 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                      paymentMethod === 'naqd'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Naqd pul</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('karta')}
                    className={`py-2 px-2 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                      paymentMethod === 'karta'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Karta / O'tkazma</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('hisob_raqam')}
                    className={`py-2 px-2 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-all ${
                      paymentMethod === 'hisob_raqam'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Hisob raqam</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Izoh / Kim orqali berildi (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Haydovchi orqali berib yuborildi"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-colors cursor-pointer shadow-md text-xs"
                >
                  To'lovni Tasdiqlash
                </button>
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="px-4 py-3 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Payment History */}
      {viewHistoryDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">To'lovlar Tarixi</h3>
              </div>
              <button
                onClick={() => setViewHistoryDebt(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="font-bold text-stone-900">{viewHistoryDebt.supplierName}</div>
                <div className="text-[11px] text-stone-500 mt-0.5">{viewHistoryDebt.productSummary}</div>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-200 text-xs font-bold">
                  <span>Jami partiya: {formatMoney(viewHistoryDebt.totalDebt)}</span>
                  <span className="text-emerald-700">To'langan: {formatMoney(viewHistoryDebt.paidAmount)}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {viewHistoryDebt.paymentHistory && viewHistoryDebt.paymentHistory.length > 0 ? (
                  viewHistoryDebt.paymentHistory.map((entry, idx) => (
                    <div 
                      key={entry.id || idx} 
                      className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-stone-900">
                          {formatMoney(entry.amount)}
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                          <span>{formatDate(entry.date)}</span>
                          <span>•</span>
                          <span className="capitalize">{entry.method}</span>
                        </div>
                        {entry.notes && (
                          <div className="text-[10px] text-stone-600 mt-1 italic">
                            "{entry.notes}"
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                        To'landi
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-stone-400">
                    To'lov yozuvlari mavjud emas
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setViewHistoryDebt(null)}
                  className="w-full py-2.5 bg-stone-100 text-stone-800 font-bold rounded-xl cursor-pointer"
                >
                  Yopish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Supplier Debt */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingDebt ? "Ta'minotchi Qarzini Tahrirlash" : "Yangi Ta'minotchi Qarzini Kiritish"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddEditModal} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Ta'minotchi / Firma nomi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Abu Saxiy Remax optom"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Telefon raqami
                  </label>
                  <input
                    type="text"
                    placeholder="+998 90 123 45 67"
                    value={formData.supplierPhone}
                    onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Olingan tovarlar / Partiya tavsifi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: 30 ta Remax kabel, 20 ta chexol va adapterlar"
                  value={formData.productSummary}
                  onChange={(e) => setFormData({ ...formData, productSummary: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Jami partiya summasi (so'm) *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formData.totalDebt || ''}
                    onChange={(e) => setFormData({ ...formData, totalDebt: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-black text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Boshida to'langan qismi (avans)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formData.totalDebt}
                    step="1000"
                    value={formData.paidAmount || ''}
                    onChange={(e) => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Remaining calculation preview */}
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">Ta'minotchiga qoladigan qarzimiz:</span>
                <span className="font-black text-sm text-red-600">
                  {formatMoney(Math.max(0, formData.totalDebt - formData.paidAmount))}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  To'lash muddati (Qaytarish sanasi)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Qo'shimcha izoh / Shartlar
                </label>
                <textarea
                  rows={2}
                  placeholder="Masalan: Qolgan puli dilerning bank kartasiga o'tkaziladi..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl transition-colors cursor-pointer text-xs"
                >
                  {editingDebt ? "O'zgarishlarni Saqlash" : "Qarzni Saqlash"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-3 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
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
