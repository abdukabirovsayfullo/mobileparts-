import React, { useState, useMemo } from 'react';
import { Product, StockMovement, PaymentMethod, DebtRecord, SaleReceiptData, CustomerProfile } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import { PrintReceiptModal } from './PrintReceiptModal';
import { customerDebtTotal } from '../utils/saleAccounting';
import { 
  ArrowUpRight, 
  Search, 
  ShoppingCart, 
  Trash2, 
  CheckCircle2, 
  Wallet, 
  CreditCard, 
  BookOpen, 
  TrendingUp, 
  AlertTriangle,
  Receipt,
  Plus,
  Printer,
  MapPin,
  User,
  Phone,
  Clock,
  History,
  Sparkles,
  ChevronDown,
  X,
  Percent,
  Tag,
  Briefcase,
  Edit3,
  Package,
  Eye,
  EyeOff,
  FileText,
  SlidersHorizontal
} from 'lucide-react';

interface ChiqimFormViewProps {
  products: Product[];
  recentChiqimMovements: StockMovement[];
  customers?: CustomerProfile[];
  debts?: DebtRecord[];
  onConfirmChiqim: (
    items: {
      product: Product;
      quantity: number;
      unitPrice: number;
    }[],
    paymentMethod: PaymentMethod,
    customerName: string,
    customerPhone: string,
    customerAddress: string,
    notes: string,
    debtDetails?: {
      paidNow: number;
      dueDate: string;
      discountAmount?: number;
      receiptNumber?: string;
    }
  ) => void;
  onPrintReceipt?: (movement: StockMovement) => void;
  onQuickPayPastDebt?: (debtId: string, amount: number, method: 'naqd' | 'click_payme') => void;
}

interface ChiqimCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  priceType?: 'chakana' | 'optom' | 'maxsus';
}

export const ChiqimFormView: React.FC<ChiqimFormViewProps> = ({
  products,
  recentChiqimMovements,
  customers = [],
  debts = [],
  onConfirmChiqim,
  onPrintReceipt,
  onQuickPayPastDebt
}) => {
  const [cart, setCart] = useState<ChiqimCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Optom vs Chakana mode
  const [priceMode, setPriceMode] = useState<'chakana' | 'optom'>('chakana');

  // Skitka (Chegirma)
  const [discountType, setDiscountType] = useState<'som' | 'foiz'>('som');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Checkout inputs
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('naqd');
  const [customerName, setCustomerName] = useState('Do\'kon mijozi');
  const [customerPhone, setCustomerPhone] = useState('+998 ');
  const [customerAddress, setCustomerAddress] = useState('Do\'kondan olib ketildi (Paxtaobod)');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  // Toggle 'Price View' mode for sales receipt: true = full prices, false = only product names, quantities, and categories
  const [receiptPriceView, setReceiptPriceView] = useState<boolean>(true);
  const [printOnOpen, setPrintOnOpen] = useState(false);
  const [receiptToPrint, setReceiptToPrint] = useState<SaleReceiptData | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);

  // Mobile view tab toggle: 'catalog' vs 'cart'
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // CRM autocomplete & dropdown state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Quick Pay Modal for Past Debt
  const [selectedDebtToPay, setSelectedDebtToPay] = useState<DebtRecord | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayMethod, setQuickPayMethod] = useState<'naqd' | 'click_payme'>('naqd');

  // Nasiya inputs if paymentMethod === 'nasiya'
  const [nasiyaDueDate, setNasiyaDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });

  // Calculate customer debt and past records automatically!
  const customerDebtInfo = useMemo(() => {
    if (!customerName || customerName.trim() === "Do'kon mijozi") {
      return { totalDebt: 0, activeDebts: [], customerRecord: null };
    }
    const cleanName = customerName.trim().toLowerCase();
    
    // Find debts matching name
    const activeDebts = debts.filter(
      (d) => d.customerName.trim().toLowerCase() === cleanName && d.status !== 'yopildi'
    );
    const totalDebt = customerDebtTotal(debts, customerName);

    // Find known customer profile
    const customerRecord = customers.find(
      (c) => c.name.trim().toLowerCase() === cleanName
    );

    return { totalDebt, activeDebts, customerRecord };
  }, [customerName, debts, customers]);

  // Autocomplete matching customers
  const matchingCustomers = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q || q === "do'kon mijozi") {
      return customers;
    }
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customerName, customers]);

  // Helper to select a customer
  const handleSelectCustomer = (c: CustomerProfile) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '+998 ');
    setCustomerAddress(c.address || 'Paxtaobod');
    setShowCustomerDropdown(false);
  };

  // Filter products for quick selection
  const filteredProducts = products.filter((p) => {
    if (!p) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = String(p.name || '').toLowerCase();
      const pBarcode = String(p.barcode || '').toLowerCase();
      const pBrand = String(p.brand || '').toLowerCase();
      return (
        pName.includes(q) ||
        pBarcode.includes(q) ||
        pBrand.includes(q)
      );
    }
    return true;
  });

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Add to sales cart with active price mode (Optom or Chakana)
  const handleAddToCart = (product: Product, overridePrice?: number) => {
    if (product.stock <= 0) {
      alert('Ushbu mahsulot omborda qolmagan!');
      return;
    }

    const defaultPrice = overridePrice !== undefined 
      ? overridePrice 
      : (priceMode === 'optom' ? (product.wholesalePrice || Math.round(product.sellingPrice * 0.8)) : product.sellingPrice);

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Omborda faqat ${product.stock} dona mavjud!`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: defaultPrice,
          priceType: priceMode
        }
      ];
    });
  };

  // Mass switch cart prices between Optom and Chakana
  const handleSetCartMode = (mode: 'chakana' | 'optom') => {
    setPriceMode(mode);
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        unitPrice:
          mode === 'optom'
            ? item.product.wholesalePrice || Math.round(item.product.sellingPrice * 0.8)
            : item.product.sellingPrice,
        priceType: mode
      }))
    );
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              alert(`Omborda faqat ${item.product.stock} dona bor!`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Immediate in-place price edit for a product in cart
  const handleUpdatePrice = (productId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId 
          ? { ...item, unitPrice: Math.max(0, newPrice), priceType: 'maxsus' } 
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Subtotal, Discount & Grand Total Calculations
  const subtotalRevenue = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const subtotalCost = cart.reduce(
    (sum, item) => sum + item.quantity * item.product.purchasePrice,
    0
  );

  const discountAmount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountType === 'som') {
      return Math.min(subtotalRevenue, Math.max(0, discountValue));
    } else {
      const pct = Math.min(100, Math.max(0, discountValue));
      return Math.min(subtotalRevenue, Math.round((subtotalRevenue * pct) / 100));
    }
  }, [subtotalRevenue, discountValue, discountType]);

  const grandTotalRevenue = Math.max(0, subtotalRevenue - discountAmount);
  const estimatedProfit = grandTotalRevenue - subtotalCost;

  // Auto-debt calculation when customer pays less than bill
  const isUnderpaid = cashReceived > 0 && cashReceived < grandTotalRevenue;
  const unpaidRemaining = isUnderpaid
    ? grandTotalRevenue - cashReceived
    : paymentMethod === 'nasiya'
    ? Math.max(0, grandTotalRevenue - (cashReceived || 0))
    : 0;

  const changeAmount = cashReceived > grandTotalRevenue ? cashReceived - grandTotalRevenue : 0;

  const handleFinalizeSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Avval sotilayotgan tovarlarni tanlang!');
      return;
    }

    const currentCustomer = customerName.trim() || 'Do\'kon mijozi';
    const currentPhone = customerPhone.trim();
    const currentAddress = customerAddress.trim() || 'Do\'kondan olib ketildi (Paxtaobod)';
    const currentNotes = notes.trim();

    // Determine how much is paid and if debt should be generated
    const effectivePaid = paymentMethod === 'nasiya'
      ? Math.min(Math.max(0, cashReceived || 0), grandTotalRevenue)
      : (cashReceived > 0 ? Math.min(cashReceived, grandTotalRevenue) : grandTotalRevenue);
    const effectiveRemainingDebt = Math.max(0, grandTotalRevenue - effectivePaid);

    const willBeDebt = effectiveRemainingDebt > 0;
    const salePaymentMethod = willBeDebt ? 'nasiya' : paymentMethod === 'nasiya' ? 'naqd' : paymentMethod;

    const receiptNum = `PB-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const saleNotesWithDiscount = discountAmount > 0
      ? `${currentNotes ? currentNotes + ' | ' : ''}Chegirma (Skitka): ${formatMoney(discountAmount)}`
      : currentNotes;

    onConfirmChiqim(
      cart,
      salePaymentMethod,
      currentCustomer,
      currentPhone,
      currentAddress,
      saleNotesWithDiscount,
      { paidNow: effectivePaid, dueDate: nasiyaDueDate, discountAmount, receiptNumber: receiptNum }
    );

    // If autoPrintReceipt is active, open the receipt modal immediately
    if (autoPrintReceipt) {
      const generatedReceipt: SaleReceiptData = {
        receiptNumber: receiptNum,
        date: new Date().toISOString(),
        customerName: currentCustomer,
        customerPhone: currentPhone,
        customerAddress: currentAddress,
        paymentMethod: salePaymentMethod,
        items: cart.map((c) => ({
          id: c.product.id,
          name: c.product.name,
          category: c.product.category,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          total: c.quantity * c.unitPrice
        })),
        subtotal: subtotalRevenue,
        total: grandTotalRevenue,
        paidAmount: effectivePaid,
        changeAmount: changeAmount,
        notes: saleNotesWithDiscount,
        cashierName: 'Sayfullo (Hisobchi)',
        isDebt: willBeDebt,
        debtRemaining: effectiveRemainingDebt,
        previousCustomerDebt: customerDebtInfo.totalDebt,
        customerTotalDebt: customerDebtInfo.totalDebt + effectiveRemainingDebt,
        debtDueDate: willBeDebt ? nasiyaDueDate : undefined,
        showPrices: receiptPriceView
      };
      setPrintOnOpen(true);
      setReceiptToPrint(generatedReceipt);
    }

    setCart([]);
    setCashReceived(0);
    setDiscountValue(0);
    setNotes('');
  };

  const handlePreviewCartReceipt = (showPricesOnly: boolean) => {
    if (cart.length === 0) return;
    const currentCustomer = customerName.trim() || "Do'kon mijozi";
    const currentPhone = customerPhone.trim();
    const currentAddress = customerAddress.trim() || "Do'kondan olib ketildi (Paxtaobod)";
    const receiptNum = `PB-ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const tempReceipt: SaleReceiptData = {
      receiptNumber: receiptNum,
      date: new Date().toISOString(),
      customerName: currentCustomer,
      customerPhone: currentPhone,
      customerAddress: currentAddress,
      paymentMethod: paymentMethod,
      items: cart.map((c) => ({
        id: c.product.id,
        name: c.product.name,
        category: c.product.category,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        total: c.quantity * c.unitPrice
      })),
      subtotal: subtotalRevenue,
      discount: discountAmount,
      total: grandTotalRevenue,
      paidAmount: paymentMethod === 'nasiya' ? Math.min(Math.max(0, cashReceived), grandTotalRevenue) : cashReceived > 0 ? Math.min(cashReceived, grandTotalRevenue) : grandTotalRevenue,
      isDebt: unpaidRemaining > 0,
      debtRemaining: unpaidRemaining,
      previousCustomerDebt: customerDebtInfo.totalDebt,
      customerTotalDebt: customerDebtInfo.totalDebt + unpaidRemaining,
      debtDueDate: unpaidRemaining > 0 ? nasiyaDueDate : undefined,
      notes: notes,
      cashierName: 'Sayfullo (Hisobchi)',
      showPrices: showPricesOnly
    };

    setReceiptPriceView(showPricesOnly);
    setPrintOnOpen(false);
    setReceiptToPrint(tempReceipt);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Desktop Header Banner */}
      <div className="hidden lg:flex bg-amber-400 text-stone-950 rounded-3xl p-6 sm:p-8 shadow-md flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950 text-white text-xs font-bold uppercase tracking-wider">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            <span>Tovar Chiqimi &amp; Sotuv (Kassa)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-950">
            Sotuv va Kassa (Chiqim)
          </h2>
          <p className="text-xs sm:text-sm text-stone-800 max-w-xl font-medium">
            Sotilgan tovarlarni tanlang, xaridorni kiriting va to'lov turini belgilang. Tovar avtomatik ombordan yechiladi.
          </p>
        </div>

        {/* Live Sale Total Box (Confidential - No Profit Shown) */}
        <div className="bg-stone-950 text-white p-4 rounded-2xl border border-stone-800 min-w-[220px]">
          <div className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
            Jami Savdo (Tushum):
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {formatMoney(grandTotalRevenue)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5 flex justify-between">
            <span>Tanlangan tovarlar:</span>
            <span className="font-bold text-amber-400">{cart.reduce((s, i) => s + i.quantity, 0)} dona</span>
          </div>
        </div>
      </div>

      {/* Mobile Compact Kassa Strip */}
      <div className="lg:hidden bg-amber-400 text-stone-950 rounded-2xl p-3 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-800">
            Kassa &amp; Savdo
          </div>
          <div className="text-xs font-black text-stone-950">
            Savat: {cart.reduce((s, i) => s + i.quantity, 0)} dona
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-stone-800 font-bold uppercase">Savdo summasi:</div>
          <div className="text-sm font-black text-stone-950">{formatMoney(grandTotalRevenue)}</div>
        </div>
      </div>

      {/* Mobile Segmented Switch (Telefonda Katalog vs Savat) */}
      <div className="lg:hidden flex items-center bg-stone-900 p-1 rounded-2xl border border-stone-800 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'catalog'
              ? 'bg-amber-400 text-stone-950 shadow-xs'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Katalog (Tovarlar)</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            mobileTab === 'cart'
              ? 'bg-amber-400 text-stone-950 shadow-xs'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Savat &amp; To'lov ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Main Grid: Catalog to select (7 cols) + Sales Cart & Checkout (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Side: Product Picker */}
        <div className={`${mobileTab === 'catalog' ? 'block' : 'hidden'} lg:block lg:col-span-7 space-y-4`}>
          {/* Price Mode Selector: Chakana vs Optom */}
          <div className="bg-stone-900 text-white rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5 border border-stone-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-300">Sotish rejimi:</span>
              <div className="inline-flex rounded-xl p-0.5 bg-stone-800 border border-stone-700">
                <button
                  type="button"
                  onClick={() => handleSetCartMode('chakana')}
                  className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    priceMode === 'chakana'
                      ? 'bg-amber-400 text-stone-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Chakana (Standart)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetCartMode('optom')}
                  className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    priceMode === 'optom'
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Optom (Ulgurji)</span>
                </button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-stone-400">Savatni:</span>
                <button
                  type="button"
                  onClick={() => handleSetCartMode('optom')}
                  className="px-2 py-1 bg-stone-800 hover:bg-blue-600 text-stone-200 hover:text-white rounded-md font-bold transition-colors cursor-pointer border border-stone-700"
                >
                  Optomga o'tkazish
                </button>
                <button
                  type="button"
                  onClick={() => handleSetCartMode('chakana')}
                  className="px-2 py-1 bg-stone-800 hover:bg-amber-400 hover:text-stone-950 text-stone-200 rounded-md font-bold transition-colors cursor-pointer border border-stone-700"
                >
                  Chakanaga o'tkazish
                </button>
              </div>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Aksessuar nomi, brendi yoki shtrix-kodi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-bold transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-400 text-stone-950 shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  {cat === 'all' ? 'Barcha tovarlar' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Cards with both Retail & Wholesale prices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const isLowStock = p.stock <= p.minStockAlert;
              const isOutOfStock = p.stock <= 0;
              const wholesalePrice = p.wholesalePrice || Math.round(p.sellingPrice * 0.8);

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && handleAddToCart(p)}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
                    isOutOfStock
                      ? 'opacity-50 border-stone-200 cursor-not-allowed'
                      : priceMode === 'optom'
                      ? 'border-blue-200 hover:border-blue-500 hover:shadow-sm'
                      : 'border-stone-200 hover:border-amber-400 hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                        {p.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-red-100 text-red-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        Qoldiq: {p.stock} ta
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-stone-900 line-clamp-2 mt-1">
                      {p.name}
                    </h4>
                  </div>

                  <div className="pt-3 border-t border-stone-100 mt-3 space-y-1.5">
                    {/* Chakana & Optom Prices */}
                    <div className="grid grid-cols-2 gap-1.5 bg-stone-50 p-2 rounded-xl border border-stone-200/80">
                      <div>
                        <div className="text-[10px] text-stone-500 font-semibold">Chakana narx:</div>
                        <div className={`font-black text-xs ${priceMode === 'chakana' ? 'text-amber-600 text-sm' : 'text-stone-800'}`}>
                          {formatMoney(p.sellingPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-blue-600 font-semibold">Optom narx:</div>
                        <div className={`font-black text-xs ${priceMode === 'optom' ? 'text-blue-600 text-sm' : 'text-stone-700'}`}>
                          {formatMoney(wholesalePrice)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>Kod: {p.barcode ? p.barcode.slice(-6) : 'Mavjud'}</span>
                      <span className="font-semibold text-stone-600">
                        Omborda: {p.stock} ta
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Mobile Cart Bar when browsing Catalog on Phone */}
        {cart.length > 0 && mobileTab === 'catalog' && (
          <div className="no-print lg:hidden fixed bottom-16 inset-x-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className="w-full bg-amber-400 hover:bg-amber-300 text-stone-950 p-3 rounded-2xl shadow-2xl flex items-center justify-between font-black border-2 border-stone-950 active:scale-98 transition-transform cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center text-sm shadow-xs">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-black">{cart.reduce((s, i) => s + i.quantity, 0)} ta tovar savatda</div>
                  <div className="text-[11px] text-stone-800 font-bold">{formatMoney(grandTotalRevenue)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-950 text-amber-400 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs">
                <span>Rasmiylashtirish</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Right Side: Sales Cart & Checkout (5 cols) */}
        <div className={`${mobileTab === 'cart' ? 'block' : 'hidden'} lg:block lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs flex flex-col space-y-4`}>
          {/* Mobile Back to Catalog Button */}
          <div className="lg:hidden flex items-center justify-between pb-2 border-b border-stone-100">
            <button
              type="button"
              onClick={() => setMobileTab('catalog')}
              className="text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <span>← Katalogga qaytish</span>
            </button>
            <span className="text-xs font-black text-amber-600">
              Jami: {formatMoney(grandTotalRevenue)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between border-b border-stone-100 pb-3 gap-2">
            <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              <span>Chiqim Savatchasi ({cart.length})</span>
            </h3>
            {cart.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreviewCartReceipt(false)}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                  title="Savatdagi tovarlarni narxlarsiz Buyurtma Ro'yxati (Order list) sifatida ko'rish va chop etish"
                >
                  <EyeOff className="w-3 h-3 text-emerald-600" />
                  <span>Order List</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePreviewCartReceipt(true)}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                  title="Savatdagi tovarlarni to'liq kassa cheki ko'rinishida ko'rish"
                >
                  <Receipt className="w-3 h-3 text-amber-600" />
                  <span>Chek</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer ml-1 p-0.5 hover:bg-red-50 rounded"
                  title="Savatni tozalash"
                >
                  Tozalash
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List with INLINE PRICE EDITING & QUICK OPTOM/CHAKANA BUTTONS */}
          <div className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto divide-y divide-stone-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-1">
                <ShoppingCart className="w-8 h-8 text-stone-300" />
                <span className="text-xs">Savatcha bo'sh</span>
                <span className="text-[11px] text-stone-400">
                  Chapdagi aksessuarlarni bosib savatga qo'shing.
                </span>
              </div>
            ) : (
              cart.map((item) => {
                const optomPrice = item.product.wholesalePrice || Math.round(item.product.sellingPrice * 0.8);
                const chakanaPrice = item.product.sellingPrice;

                return (
                  <div key={item.product.id} className="py-3 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-stone-900 truncate">
                        {item.product.name}
                      </span>
                      <button
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="text-stone-400 hover:text-red-600 cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Quantity buttons */}
                      <div className="flex items-center border border-stone-200 rounded-lg bg-stone-50 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="px-2 py-1 text-stone-600 font-bold hover:bg-stone-200 rounded-l-lg cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2 font-black text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="px-2 py-1 text-stone-600 font-bold hover:bg-stone-200 rounded-r-lg cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* INLINE EDITABLE PRICE INPUT (O'sha joyning o'zida narxni tahrirlash) */}
                      <div className="flex items-center gap-1">
                        <Edit3 className="w-3 h-3 text-stone-400 shrink-0" />
                        <input
                          type="number"
                          step="500"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdatePrice(item.product.id, Number(e.target.value))}
                          className="w-24 px-1.5 py-1 bg-white border border-stone-300 rounded-md text-right font-black text-xs text-stone-950 focus:ring-1 focus:ring-amber-400"
                          title="Narxni o'sha joyning o'zida tahrirlash"
                        />
                        <span className="text-[10px] text-stone-500 font-bold">so'm</span>
                      </div>

                      {/* Total line item revenue */}
                      <div className="text-right shrink-0">
                        <div className="font-black text-stone-900 text-sm">
                          {formatMoney(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>

                    {/* Quick Optom & Chakana snap buttons for this item */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-stone-400">Tezkor:</span>
                      <button
                        type="button"
                        onClick={() => handleUpdatePrice(item.product.id, optomPrice)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          item.unitPrice === optomPrice
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700'
                        }`}
                      >
                        Optom: {formatMoney(optomPrice)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdatePrice(item.product.id, chakanaPrice)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          item.unitPrice === chakanaPrice
                            ? 'bg-amber-400 border-amber-500 text-stone-950'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700'
                        }`}
                      >
                        Chakana: {formatMoney(chakanaPrice)}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleFinalizeSale} className="border-t border-stone-100 pt-3 space-y-3 text-xs">
            {/* Payment Method Selector */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                To'lov Turi:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'naqd', label: 'Naqd' },
                  { id: 'click_payme', label: 'Click' },
                  { id: 'uzum', label: 'Uzum' },
                  { id: 'nasiya', label: 'Nasiya' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id as PaymentMethod);
                      if (m.id === 'nasiya') setShowAdditional(true);
                    }}
                    className={`py-1.5 rounded-xl font-bold text-center cursor-pointer transition-colors ${
                      paymentMethod === m.id
                        ? m.id === 'nasiya'
                          ? 'bg-red-500 text-white'
                          : 'bg-stone-950 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional checkout details */}
            <button
              type="button"
              onClick={() => setShowAdditional((current) => !current)}
              aria-expanded={showAdditional}
              className="w-full flex items-center justify-between gap-3 p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-left transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <span>
                  <span className="block text-xs font-black text-stone-900">Qo'shimcha</span>
                  <span className="block text-[10px] text-stone-500">Chegirma, mijoz, izoh va chek sozlamalari</span>
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${showAdditional ? 'rotate-180' : ''}`} />
            </button>

            {/* Skitka (Chegirma qilish) - 5-talab */}
            {showAdditional && <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-600" />
                  <span>Skitka (Chegirma berish):</span>
                </span>
                <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('som')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      discountType === 'som' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    So'mda
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('foiz')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      discountType === 'foiz' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    % Foizda
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === 'som' ? "Chegirma so'mda (masalan: 15 000)" : "Chegirma foizda (masalan: 5)"}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">
                    {discountType === 'som' ? "so'm" : "%"}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="px-2 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg font-black text-xs shrink-0">
                    -{formatMoney(discountAmount)}
                  </div>
                )}
              </div>
            </div>}

            {/* If Cash or partial payment: Amount Received & Auto-Debt Logic (1-talab) */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-700">
                  {paymentMethod === 'nasiya' ? "Hozir berilgan naqd pul (bo'lsa):" : "Mijoz to'lagan / bergan summa:"}
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1000"
                    placeholder={`To'liq: ${grandTotalRevenue}`}
                    value={cashReceived || ''}
                    min="0"
                    onChange={(e) => {
                      const nextAmount = Math.max(0, Number(e.target.value));
                      setCashReceived(nextAmount);
                      if (nextAmount > 0 && nextAmount < grandTotalRevenue) setShowAdditional(true);
                    }}
                    className="w-32 px-2 py-1 bg-white border border-stone-300 rounded-lg text-right font-black text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="text-[10px] text-stone-500 font-bold">so'm</span>
                </div>
              </div>

              {/* Exact Change Calculation */}
              <div className="space-y-1 text-xs font-bold border-t border-stone-200 pt-2">
                <div className="flex justify-between"><span>Eski qarz:</span><span>{formatMoney(customerDebtInfo.totalDebt)}</span></div>
                <div className="flex justify-between"><span>Bu savdodan qarz:</span><span>{formatMoney(unpaidRemaining)}</span></div>
                <div className="flex justify-between text-red-700"><span>Jami qarzdorlik:</span><span>{formatMoney(customerDebtInfo.totalDebt + unpaidRemaining)}</span></div>
              </div>
              {changeAmount > 0 && (
                <div className="flex justify-between font-black text-amber-700 pt-1.5 border-t border-stone-200">
                  <span>Qaytim (sdacha):</span>
                  <span className="text-sm">{formatMoney(changeAmount)}</span>
                </div>
              )}

              {/* 1-TALAB: Bergan summadan qolgan pulni qarzga o'tkazib qo'yish! */}
              {isUnderpaid && (
                <div className="p-2.5 bg-red-50 border-2 border-red-400 rounded-xl space-y-2 mt-1">
                  <div className="flex items-center gap-1.5 text-red-800 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>BERILGAN PUL KAM: QOLGAN SUMMA QARZGA O'TADI!</span>
                  </div>
                  <div className="text-[11px] text-stone-700">
                    Mijoz to'lagan: <strong className="text-emerald-700">{formatMoney(cashReceived)}</strong>.
                    <br />
                    Qolgan qarz: <strong className="text-red-700 text-xs font-black">{formatMoney(unpaidRemaining)}</strong> avtomatik ravishda Nasiya (Qarz) ro'yxatiga yoziladi.
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-red-800 block mb-1">
                      Qarzni qaytarish va'da sanasi:
                    </label>
                    <input
                      type="date"
                      value={nasiyaDueDate}
                      onChange={(e) => setNasiyaDueDate(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-red-300 rounded-lg text-xs font-bold text-stone-900"
                    />
                  </div>
                </div>
              )}

              {(paymentMethod === 'nasiya' || isUnderpaid) && (
                <div className="pt-2 border-t border-stone-200">
                  <label className="text-[10px] font-bold text-red-700 block mb-1">
                    Qarzni qaytarish sanasi
                  </label>
                  <input
                    type="date"
                    value={nasiyaDueDate}
                    onChange={(e) => setNasiyaDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>
              )}
            </div>

            {/* Customer & Delivery / Destination Information (Kimga & Qayerga) with CRM Memory & Debt Auto-Detection */}
            {showAdditional && <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-700" />
                  <span>Xaridor va Joylashuv (Kimga & Qayerga):</span>
                </span>
                <span className="text-[10px] text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md font-bold">
                  Avtomatik eslab qolinadi
                </span>
              </div>

              {/* Quick Customer Selection Chips */}
              {customers.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-stone-500 mb-1.5 flex items-center gap-1">
                    <History className="w-3 h-3 text-stone-400" />
                    <span>Doimiy / Avvalgi xaridorlar (Tezkor tanlash):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {customers.slice(0, 8).map((c) => {
                      const cDebts = debts.filter(
                        (d) => d.customerName.trim().toLowerCase() === c.name.trim().toLowerCase() && d.status !== 'yopildi'
                      );
                      const cDebtTotal = cDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
                      const isSelected = customerName.trim().toLowerCase() === c.name.trim().toLowerCase();

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-500 shadow-xs'
                              : cDebtTotal > 0
                              ? 'bg-red-50 hover:bg-red-100 text-red-800 border border-red-200'
                              : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-200'
                          }`}
                        >
                          <span>{c.name}</span>
                          {cDebtTotal > 0 ? (
                            <span className="px-1.5 py-0.2 bg-red-200 text-red-900 text-[10px] rounded font-black">
                              ⚠️ {formatMoney(cDebtTotal)} qarz
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Do\'kon mijozi');
                        setCustomerPhone('+998 ');
                        setCustomerAddress('Do\'kondan olib ketildi (Paxtaobod)');
                        setShowCustomerDropdown(false);
                      }}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Oddiy mijoz
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Name Input with Autocomplete */}
              <div className="relative">
                <label className="text-[10px] font-bold text-stone-700 block mb-1">
                  Kimga sotildi (Mijoz / Do'kon / Usta ismi) — ixtiyoriy
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ixtiyoriy: Akromjon, Rustam usta..."
                    value={customerName}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  {customerName && (
                    <button
                      type="button"
                      onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600 p-0.5"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showCustomerDropdown && matchingCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-stone-100">
                    <div className="px-3 py-1.5 bg-stone-50 text-[10px] font-bold text-stone-500 flex justify-between items-center">
                      <span>Topilgan xaridorlar ({matchingCustomers.length})</span>
                      <button
                        type="button"
                        onClick={() => setShowCustomerDropdown(false)}
                        className="text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {matchingCustomers.map((c) => {
                      const cDebts = debts.filter(
                        (d) => d.customerName.trim().toLowerCase() === c.name.trim().toLowerCase() && d.status !== 'yopildi'
                      );
                      const cDebtTotal = cDebts.reduce((sum, d) => sum + d.remainingAmount, 0);

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="px-3 py-2 hover:bg-amber-50/70 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.phone && <span className="text-[10px] text-stone-500 font-normal">({c.phone})</span>}
                            </div>
                            <div className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-stone-400" />
                              <span className="truncate max-w-[200px]">{c.address || 'Manzil ko\'rsatilmagan'}</span>
                            </div>
                          </div>
                          {cDebtTotal > 0 ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md shrink-0">
                              ⚠️ {formatMoney(cDebtTotal)} qarz
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md shrink-0">
                              Toza
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-stone-600 block mb-1">
                    Telefon raqami
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="+998 90 123 45 67"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-600 block mb-1">
                    Qayerga sotildi (Manzil / Joylashuv) *
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="Masalan: Paxtaobod, Dehqon bozori 12-do'kon"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* AUTOMATIC DEBT DETECTION BANNER */}
              {customerDebtInfo.totalDebt > 0 ? (
                <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-red-800 font-black text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 animate-bounce" />
                      <span>OGOHLANTIRISH: Ushbu mijozda avvaldan to'lanmagan qarz bor!</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-red-600 text-white rounded-full font-black text-xs whitespace-nowrap shadow-xs">
                      {formatMoney(customerDebtInfo.totalDebt)}
                    </span>
                  </div>

                  {/* Active debts breakdown */}
                  <div className="bg-white/90 rounded-lg p-2 border border-red-200 text-[11px] space-y-1">
                    {customerDebtInfo.activeDebts.map((d) => (
                      <div key={d.id} className="flex justify-between items-center text-stone-800">
                        <div>
                          <span className="font-bold text-stone-900">{d.notes || "Oldingi aksessuar xaridi"}</span>
                          <span className="text-[10px] text-stone-500 ml-1.5">
                            (Muddat: {formatDate(d.dueDate)})
                          </span>
                        </div>
                        <span className="font-black text-red-600">
                          {formatMoney(d.remainingAmount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action to accept debt payment right here */}
                  {onQuickPayPastDebt && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-red-700 font-semibold">
                        Mijoz eski qarzini ham to'lamoqchimi?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetDebt = customerDebtInfo.activeDebts[0];
                          setSelectedDebtToPay(targetDebt);
                          setQuickPayAmount(targetDebt.remainingAmount);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Eski qarzni so'ndirish</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : customerDebtInfo.customerRecord ? (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <span className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mijoz tekshirildi: Avvalgi qarzlari yo'q (Toza)</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Doimiy mijoz</span>
                </div>
              ) : null}

            </div>}

            {showAdditional && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <label className="text-[10px] font-bold text-stone-700 block mb-1">
                  Qo'shimcha izoh
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Savdo yoki mijoz haqida ixtiyoriy izoh..."
                  className="w-full resize-none px-2.5 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            )}

            {/* Chek va Nakladnoy Sozlamalari (Receipt & Order List Options) */}
            {showAdditional && <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                  {receiptPriceView ? (
                    <Eye className="w-4 h-4 text-amber-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Chek & Nakladnoy Narx Rejimi:</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                  receiptPriceView 
                    ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}>
                  {receiptPriceView ? "Narxlar Ko'rinsin" : "Narxlarsiz (Order List)"}
                </span>
              </div>

              {/* Price View Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-lg border border-stone-200">
                <button
                  type="button"
                  onClick={() => setReceiptPriceView(true)}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    receiptPriceView
                      ? 'bg-amber-400 text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Narxlar bilan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPriceView(false)}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !receiptPriceView
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Narxlarsiz (Order List)</span>
                </button>
              </div>

              <p className="text-[10px] text-stone-500 leading-snug">
                {receiptPriceView
                  ? "Chek va PDF nakladnoyda barcha donasi, narxi va to'lov summalari ko'rsatiladi."
                  : "Chek va PDF'da narxlar yashirilib, faqat tovar nomi, toifasi va donasi ko'rsatiladi (ta'minotchi yoki mijozga buyurtma tashlash uchun)."}
              </p>

              {/* Auto Print Checkbox */}
              <label className="flex items-center gap-2 pt-2 border-t border-stone-200/80 cursor-pointer text-xs font-bold text-stone-700 hover:text-stone-900 transition-colors">
                <input
                  type="checkbox"
                  checked={autoPrintReceipt}
                  onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-stone-300 focus:ring-amber-400 cursor-pointer accent-amber-500"
                />
                <Printer className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Sotuvdan so'ng darhol chek oynasini ochish</span>
              </label>
            </div>}

            {/* Sticky sale action panel */}
            <div className="sticky bottom-16 lg:bottom-4 z-20 p-3 bg-stone-950/95 backdrop-blur rounded-2xl border border-stone-700 shadow-2xl space-y-2">
              <div className="flex items-center justify-between gap-3 text-white">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                    {cart.length} xil / {cart.reduce((s, i) => s + i.quantity, 0)} dona
                  </div>
                  <div className="text-lg font-black text-amber-400">{formatMoney(grandTotalRevenue)}</div>
                </div>
                {unpaidRemaining > 0 && (
                  <div className="text-right text-[10px] text-red-300 font-bold">
                    Qarzga: {formatMoney(unpaidRemaining)}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={cart.length === 0}
                className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  cart.length > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-md active:scale-[0.99]'
                    : 'bg-stone-700 text-stone-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Sotish</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Recent Sales History */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Oxirgi Chiqqan (Sotilgan) Aksessuarlar Ro'yxati</span>
          </h3>
          <span className="text-xs text-stone-400">
            Har bir sotuv uchun printer tugmasini bosib chek chiqara olasiz
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Sana / Vaqt</th>
                <th className="py-2.5 px-3">Tovar Nomi</th>
                <th className="py-2.5 px-3 text-center">Soni</th>
                <th className="py-2.5 px-3 text-right">Sotilgan Narx</th>
                <th className="py-2.5 px-3 text-right">Jami Tushum</th>
                <th className="py-2.5 px-3">To'lov</th>
                <th className="py-2.5 px-3">Kimga / Qayerga</th>
                <th className="py-2.5 px-3 text-center">Chek / Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentChiqimMovements.slice(0, 10).map((m) => (
                <tr key={m.id} className="hover:bg-stone-50/60">
                  <td className="py-2.5 px-3 text-stone-400 whitespace-nowrap">
                    {formatDate(m.timestamp)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-stone-900">
                    {m.productName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-stone-900">
                    {m.quantity} ta
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-stone-800">
                    {formatMoney(m.unitPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-stone-900">
                    {formatMoney(m.totalRevenue)}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold text-[10px]">
                    <span className={`px-2 py-0.5 rounded ${
                      m.paymentMethod === 'naqd'
                        ? 'bg-stone-100 text-stone-800'
                        : m.paymentMethod === 'nasiya'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {m.paymentMethod?.toUpperCase() || 'NAQD'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-stone-700">
                    <div className="font-bold text-stone-900">{m.counterparty}</div>
                    {m.customerAddress && (
                      <div className="text-[10px] text-stone-500 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        <span className="truncate max-w-[130px]">{m.customerAddress}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (onPrintReceipt) { onPrintReceipt(m); return; }
                        const rec: SaleReceiptData = {
                          receiptNumber: m.receiptNumber || `PB-${m.id.slice(-6)}`,
                          date: m.timestamp,
                          customerName: m.counterparty || 'Do\'kon mijozi',
                          customerPhone: m.customerPhone,
                          customerAddress: m.customerAddress || 'Do\'kondan olib ketildi (Paxtaobod)',
                          paymentMethod: m.paymentMethod || 'naqd',
                          items: [
                            {
                              id: m.productId,
                              name: m.productName,
                              category: m.category,
                              quantity: m.quantity,
                              unitPrice: m.unitPrice,
                              total: m.totalRevenue
                            }
                          ],
                          subtotal: m.totalRevenue,
                          total: m.totalRevenue,
                          cashierName: 'Sayfullo (Hisobchi)',
                          showPrices: receiptPriceView
                        };
                        setPrintOnOpen(false);
                        setReceiptToPrint(rec);
                      }}
                      className="p-1.5 bg-amber-50 hover:bg-amber-400 text-stone-800 hover:text-stone-950 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[11px] border border-amber-200"
                      title="Chek / Nakladnoyni printerdan chiqarish"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-800" />
                      <span className="hidden sm:inline">Chek</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptToPrint && (
        <PrintReceiptModal
          receipt={receiptToPrint}
          autoPrint={printOnOpen}
          showPrices={receiptPriceView}
          onToggleShowPrices={(val) => setReceiptPriceView(val)}
          onClose={() => { setReceiptToPrint(null); setPrintOnOpen(false); }}
        />
      )}

      {/* Quick Pay Past Debt Modal */}
      {selectedDebtToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-stone-900 font-black">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Eski Qarzni Qabul Qilish (So'ndirish)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDebtToPay(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Xaridor:</span>
                <span className="font-bold text-stone-900">{selectedDebtToPay.customerName}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Izoh / Tovar:</span>
                <span className="font-medium text-stone-800">{selectedDebtToPay.notes || "Aksessuarlar nasiyasi"}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Qolgan jami qarz:</span>
                <span className="font-black text-red-600 text-sm">{formatMoney(selectedDebtToPay.remainingAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Qabul qilinayotgan summa (so'm) *
                </label>
                <input
                  type="number"
                  min="1000"
                  max={selectedDebtToPay.remainingAmount}
                  step="1000"
                  value={quickPayAmount || ''}
                  onChange={(e) => setQuickPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickPayAmount(selectedDebtToPay.remainingAmount)}
                    className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Barchasini yopish ({formatMoney(selectedDebtToPay.remainingAmount)})
                  </button>
                  {selectedDebtToPay.remainingAmount > 50000 && (
                    <button
                      type="button"
                      onClick={() => setQuickPayAmount(Math.round(selectedDebtToPay.remainingAmount / 2))}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-bold cursor-pointer"
                    >
                      Yarmini to'lash
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  To'lov usuli:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickPayMethod('naqd')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      quickPayMethod === 'naqd'
                        ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Naqd pul</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPayMethod('click_payme')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      quickPayMethod === 'click_payme'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Click / Payme</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                disabled={!quickPayAmount || quickPayAmount <= 0}
                onClick={() => {
                  if (onQuickPayPastDebt && selectedDebtToPay) {
                    onQuickPayPastDebt(selectedDebtToPay.id, quickPayAmount, quickPayMethod);
                    setSelectedDebtToPay(null);
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                To'lovni Qabul Qilish &amp; Qarzni Kamaytirish
              </button>
              <button
                type="button"
                onClick={() => setSelectedDebtToPay(null)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
