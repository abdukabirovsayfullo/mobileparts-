import React, { useState, useEffect, useMemo } from 'react';
import { Product, StockMovement, PaymentMethod, DebtRecord } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  RotateCcw,
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Package,
  User,
  Phone,
  Banknote,
  CreditCard,
  BookOpen,
  Printer,
  FileText
} from 'lucide-react';

interface VazvratModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  debts: DebtRecord[];
  prefillMovement?: StockMovement | null;
  onConfirmVazvrat: (data: {
    productId: string;
    productName: string;
    category: string;
    quantity: number;
    unitPrice: number; // refund price per item
    unitCost: number; // tan narxi
    totalRefund: number;
    paymentMethod: PaymentMethod;
    customerName: string;
    customerPhone: string;
    returnReason: string;
    notes: string;
    restoreStock: boolean;
    printReceipt: boolean;
    originalMovementId?: string;
    originalReceiptNumber?: string;
  }) => void;
}

const COMMON_REASONS = [
  'Nuqsonli / Ishlamay qoldi (Brak)',
  'Razmer / Model mos kelmadi',
  'Mijoz xohishi (Fikridan qaytdi)',
  'Boshqa tovar bilan almashtirish',
  'Noto\'g\'ri xarid qilingan'
];

export const VazvratModal: React.FC<VazvratModalProps> = ({
  isOpen,
  onClose,
  products,
  debts,
  prefillMovement,
  onConfirmVazvrat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+998 ');
  const [returnReason, setReturnReason] = useState(COMMON_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('naqd');
  const [restoreStock, setRestoreStock] = useState(true);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Initialize or reset when modal opens or prefillMovement changes
  useEffect(() => {
    if (isOpen) {
      if (prefillMovement) {
        const matchingProduct = products.find((p) => p.id === prefillMovement.productId);
        setSelectedProduct(matchingProduct || {
          id: prefillMovement.productId,
          name: prefillMovement.productName,
          category: prefillMovement.category,
          brand: '',
          barcode: '',
          purchasePrice: prefillMovement.unitCost,
          sellingPrice: prefillMovement.unitPrice,
          stock: 0,
          minStockAlert: 3
        });
        setQuantity(prefillMovement.quantity || 1);
        setUnitPrice(prefillMovement.unitPrice || 0);
        setCustomerName(prefillMovement.counterparty || '');
        setCustomerPhone(prefillMovement.customerPhone || '+998 ');
        setPaymentMethod(prefillMovement.paymentMethod || 'naqd');
        setNotes(prefillMovement.receiptNumber ? `Chek: ${prefillMovement.receiptNumber}` : '');
      } else {
        setSelectedProduct(null);
        setSearchQuery('');
        setQuantity(1);
        setUnitPrice(0);
        setCustomerName('');
        setCustomerPhone('+998 ');
        setReturnReason(COMMON_REASONS[0]);
        setNotes('');
        setPaymentMethod('naqd');
        setRestoreStock(true);
        setPrintReceipt(true);
      }
    }
  }, [isOpen, prefillMovement, products]);

  // When selected product changes in manual mode, set default price
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setUnitPrice(prod.sellingPrice);
    setShowProductDropdown(false);
    setSearchQuery('');
  };

  // Filter products for manual search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, searchQuery]);

  // Check if customer has an active debt
  const matchingCustomerDebt = useMemo(() => {
    if (!customerName.trim() || customerName === "Do'kon mijozi") return null;
    const qName = customerName.trim().toLowerCase();
    return debts.find(
      (d) =>
        d.status !== 'yopildi' &&
        (d.customerName.toLowerCase().includes(qName) ||
          (customerPhone.length > 5 && d.customerPhone.includes(customerPhone.trim())))
    );
  }, [debts, customerName, customerPhone]);

  if (!isOpen) return null;

  const totalRefund = quantity * unitPrice;
  const unitCost = selectedProduct ? selectedProduct.purchasePrice : (prefillMovement ? prefillMovement.unitCost : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Iltimos, qaytarilayotgan tovarni tanlang');
      return;
    }
    if (quantity <= 0) {
      alert('Qaytarilayotgan miqdor 1 dan kam bo\'lishi mumkin emas');
      return;
    }
    if (unitPrice < 0) {
      alert('Qaytarish narxi noto\'g\'ri kiritilgan');
      return;
    }

    onConfirmVazvrat({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      category: selectedProduct.category,
      quantity,
      unitPrice,
      unitCost,
      totalRefund,
      paymentMethod,
      customerName: customerName.trim() || 'Do\'kon mijozi',
      customerPhone: customerPhone.trim(),
      returnReason,
      notes,
      restoreStock,
      printReceipt,
      originalMovementId: prefillMovement?.id,
      originalReceiptNumber: prefillMovement?.receiptNumber
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-stone-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Tovar Qaytarish (Vazvrat)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase">
                  Vazvrat
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Mijozdan tovarni qabul qilish, omborga qaytarish va to'lovni hisob-kitob qilish
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Prefill Info Banner if opened from Journal */}
          {prefillMovement && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs text-amber-900">
                <div className="font-black">
                  Avvalgi sotuv bo'yicha qaytarilmoqda:
                </div>
                <div className="text-[11px] text-amber-800">
                  {prefillMovement.receiptNumber && <span>Chek: <strong>{prefillMovement.receiptNumber}</strong> • </span>}
                  Sotilgan sana: <strong>{formatDate(prefillMovement.timestamp)}</strong> •
                  Xaridor: <strong>{prefillMovement.counterparty || 'Do\'kon mijozi'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div className="space-y-2">
            <label className="block font-black text-stone-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-500" />
                <span>Qaytarilayotgan Tovar:</span>
              </span>
              {selectedProduct && (
                <span className="text-[11px] text-stone-500 font-semibold">
                  Joriy ombor qoldig'i: <strong className="text-stone-900">{selectedProduct.stock} dona</strong>
                </span>
              )}
            </label>

            {selectedProduct ? (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-black text-sm text-stone-900">{selectedProduct.name}</div>
                  <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                    <span className="bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                      {selectedProduct.category}
                    </span>
                    <span>•</span>
                    <span>Sotish narxi: <strong>{formatMoney(selectedProduct.sellingPrice)}</strong></span>
                  </div>
                </div>

                {!prefillMovement && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setUnitPrice(0);
                    }}
                    className="text-xs font-bold text-stone-500 hover:text-red-600 bg-white border border-stone-200 px-2.5 py-1 rounded-xl cursor-pointer"
                  >
                    O'zgartirish
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Qaytarilayotgan tovar nomini yoki shtrix-kodini yozing..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {showProductDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-stone-200 shadow-xl max-h-56 overflow-y-auto z-20 divide-y divide-stone-100">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <div className="font-black text-stone-900 text-xs">{p.name}</div>
                          <div className="text-[10px] text-stone-500 font-medium">
                            {p.category} {p.barcode ? `• #${p.barcode}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-600 text-xs">{formatMoney(p.sellingPrice)}</div>
                          <div className="text-[10px] text-stone-400">Qoldiq: {p.stock} ta</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block font-bold text-stone-700 text-xs">
                Qaytarilayotgan Miqdor (dona):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-black text-base text-stone-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={prefillMovement ? prefillMovement.quantity : 999}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 py-2 text-center bg-stone-50 border border-stone-200 rounded-xl text-base font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const max = prefillMovement ? prefillMovement.quantity : 999;
                    setQuantity((q) => Math.min(max, q + 1));
                  }}
                  className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-black text-base text-stone-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
              {prefillMovement && (
                <div className="text-[10px] text-stone-500">
                  Maksimal qaytarish: {prefillMovement.quantity} dona
                </div>
              )}
            </div>

            {/* Refund Unit Price */}
            <div className="space-y-1.5">
              <label className="block font-bold text-stone-700 text-xs">
                Bir Dona Uchun Qaytarish Summasi (so'm):
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={unitPrice || ''}
                onChange={(e) => setUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full py-2.5 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="text-[10px] text-stone-500">
                Mijozga 1 dona tovar uchun qancha pul qaytariladi
              </div>
            </div>
          </div>

          {/* Refund Calculation Box */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                Mijozga Qaytariladigan Jami Summa:
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-700">
                {formatMoney(totalRefund)} so'm
              </div>
            </div>
            <div className="text-right text-[11px] text-rose-900/80">
              <div>Hisob: {quantity} dona × {formatMoney(unitPrice)}</div>
              {restoreStock && (
                <div className="text-emerald-700 font-bold flex items-center gap-1 justify-end mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ombor qoldig'i +{quantity} taga oshadi</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-stone-700 text-xs flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span>Mijoz Ismi:</span>
              </label>
              <input
                type="text"
                placeholder="Mijoz ismi (ixtiyoriy)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-stone-700 text-xs flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span>Telefon Raqami:</span>
              </label>
              <input
                type="text"
                placeholder="+998 90 123 45 67"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Return Reason */}
          <div className="space-y-2">
            <label className="block font-bold text-stone-700 text-xs flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              <span>Qaytarish Sababi:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReturnReason(r)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    returnReason === r
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Qo'shimcha izoh yoki sabab tafsiloti..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Refund Payment Method */}
          <div className="space-y-2">
            <label className="block font-bold text-stone-700 text-xs">
              Pulni Qaytarish Usuli (Mijozga qanday to'lanadi?):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('naqd')}
                className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'naqd'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/20'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="text-xs">Naqd pul</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('click_payme')}
                className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'click_payme'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-400/20'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-xs">Karta / Click</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('nasiya')}
                className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'nasiya'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span className="text-xs">Nasiyadan ayirish</span>
              </button>
            </div>

            {/* If customer has an active debt alert */}
            {matchingCustomerDebt && (
              <div className="p-3 bg-amber-50 border border-amber-300/80 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Ushbu mijozda <strong>{formatMoney(matchingCustomerDebt.remainingAmount)} so'm</strong> nasiya bor!
                  </span>
                </div>
                {paymentMethod !== 'nasiya' && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('nasiya')}
                    className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-lg text-[10px] cursor-pointer shrink-0"
                  >
                    Nasiyadan ayirish
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Options: Restore stock & Print Receipt */}
          <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-stone-800">
              <input
                type="checkbox"
                checked={restoreStock}
                onChange={(e) => setRestoreStock(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-400"
              />
              <span>Tovarni ombor qoldig'iga qayta qo'shish (+{quantity} dona stock oshadi)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-stone-800">
              <input
                type="checkbox"
                checked={printReceipt}
                onChange={(e) => setPrintReceipt(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-400"
              />
              <span className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-stone-500" />
                <span>Vazvrat kvitansiyasini (chek) avtomatik chiqarish</span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 transition-colors cursor-pointer text-xs"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={!selectedProduct || totalRefund <= 0}
              className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 disabled:opacity-50 text-white font-black shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer text-xs"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>Vazvratni Tasdiqlash ({formatMoney(totalRefund)} so'm)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
