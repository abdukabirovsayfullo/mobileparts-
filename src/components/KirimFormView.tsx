import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Currency, Product, StockMovement } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import { CategoryManagerModal } from './CategoryManagerModal';
import { KirimProductPicker } from './KirimProductPicker';
import { addDraftItem, lastKirimByProduct } from '../utils/kirimHelpers';
import { categoryCurrency, currencyOf, roundMoney } from '../utils/money';
import { 
  ArrowDownLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Search, 
  Package, 
  Building2, 
  Clock,
  Sparkles,
  Tag,
  Edit3,
  FolderPlus,
  Filter,
  Truck,
  Calendar,
  Banknote,
  FileSpreadsheet,
  Camera,
  X
} from 'lucide-react';

interface KirimFormViewProps {
  onClose: () => void;
  products: Product[];
  categories?: string[];
  supplierNames?: string[];
  recentKirimMovements: StockMovement[];
  onConfirmKirim: (
    items: {
      product: Product;
      quantity: number;
      unitCost: number;
      currency?: Currency;
      wholesalePrice?: number;
      unitPrice: number;
    }[],
    supplier: string,
    notes: string,
    supplierDebtInfo?: {
      isDebt: boolean;
      paidAmount: number;
      remainingAmount: number;
      supplierPhone?: string;
      dueDate?: string;
    }
  ) => void;
  onSubmitWorkerKirim?: (payload: {
    supplier: string; supplierPhone: string; notes: string; dueDate: string;
    groups: { paidAmount: number; items: { productId: string; quantity: number; unitCost: number; sellingPrice: number; wholesalePrice?: number; name: string; category: string }[] }[];
  }) => Promise<void>;
  onAddNewProductDirect?: (product: Product) => void;
  onAddCategory?: (categoryName: string) => boolean;
  onEditCategory?: (oldName: string, newName: string) => boolean;
  onDeleteCategory?: (categoryName: string) => boolean;
  onNavigateToSupplierDebts?: () => void;
  onOpenExcelImport?: () => void;
  onOpenPhotoKirim?: () => void;
}

interface KirimDraftItem {
  product: Product;
  quantity: number;
  unitCost: number;
  /** Barcha narxlar shu valyutada (so'm va dollar hech qachon o'girilmaydi). */
  currency: Currency;
  wholesalePrice?: number;
  unitPrice: number;
}

export const KirimFormView: React.FC<KirimFormViewProps> = ({
  onClose,
  products,
  categories = [
    'Chexollar',
    'Himoya Oynalari',
    'Zaryadniklar',
    'Kabellar',
    'Quloqchinlar',
    'Powerbanklar',
    'Avto Aksessuarlar',
    'Beeline Xizmatlari',
    'Gadjetlar'
  ],
  recentKirimMovements,
  supplierNames = [],
  onConfirmKirim,
  onSubmitWorkerKirim,
  onAddNewProductDirect,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onNavigateToSupplierDebts,
  onOpenExcelImport,
  onOpenPhotoKirim
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedProducts, setMarkedProducts] = useState<Product[]>([]);
  const [unitCost, setUnitCost] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplier, setSupplier] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Supplier Payment terms
  const [paymentType, setPaymentType] = useState<'paid' | 'partial' | 'debt'>('paid');
  const [paidAmount, setPaidAmount] = useState<Partial<Record<Currency, number>>>({});
  const [debtDueDate, setDebtDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
  );

  // Draft invoice items
  const [draftItems, setDraftItems] = useState<KirimDraftItem[]>([]);

  // Search filter for dropdown
  const [productSearch, setProductSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastKirim = useMemo(() => lastKirimByProduct(recentKirimMovements), [recentKirimMovements]);
  // Import qilingan tovarlarning kataloglari (TELEFON, KNOPKALI, EKRAN...) boshqariladigan ro'yxatda bo'lmasligi mumkin.
  const categoryOptions = useMemo(
    () => Array.from(new Set([...categories, ...products.map((p) => p.category)].filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [categories, products]
  );

  // New product inline creation
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [currencyChoice, setCurrencyChoice] = useState<Currency>();
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState(categories[0] || 'Chexollar');
  const [newProductBrand, setNewProductBrand] = useState('Universal');
  const [newProductQuantity, setNewProductQuantity] = useState('');

  // Category modal & inline management
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isInlineAddingCat, setIsInlineAddingCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  const handleQuickAddInlineCategory = () => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) return;
    if (onAddCategory) {
      const ok = onAddCategory(trimmed);
      if (ok) {
        setNewProductCategory(trimmed);
        setCurrencyChoice(undefined);
        setInlineCatName('');
        setIsInlineAddingCat(false);
      } else {
        alert(`"${trimmed}" katalogi allaqachon mavjud!`);
      }
    } else {
      setNewProductCategory(trimmed);
      setCurrencyChoice(undefined);
      setInlineCatName('');
      setIsInlineAddingCat(false);
    }
  };

  const effectiveUnitCost = Number(unitCost);
  const effectiveWholesale = Number(wholesalePrice);
  const effectiveRetail = Number(unitPrice);

  const priceCurrency: Currency = currencyChoice ?? (isCreatingNew ? categoryCurrency(newProductCategory) : 'UZS');

  // Yangi tovarda katalog o'zgarib valyuta almashsa, eski raqamlar ma'nosini yo'qotadi: tozalanadi.
  const previousCurrency = useRef(priceCurrency);
  useEffect(() => {
    if (isCreatingNew && previousCurrency.current !== priceCurrency) {
      setUnitCost(0);
      setWholesalePrice(0);
      setUnitPrice(0);
    }
    previousCurrency.current = priceCurrency;
  }, [priceCurrency, isCreatingNew]);

  /** Tan, optom va chakana narx maydoni. Narx tovarning o'z valyutasida kiritiladi va saqlanadi. */
  const priceField = (kind: 'cost' | 'wholesale' | 'retail', inputClass: string) => {
    const value = kind === 'cost' ? unitCost : kind === 'wholesale' ? wholesalePrice : unitPrice;
    const setValue = kind === 'cost' ? setUnitCost : kind === 'wholesale' ? setWholesalePrice : setUnitPrice;
    const usd = priceCurrency === 'USD';
    return (
      <input
        type="number"
        min={usd ? '0.01' : '1'}
        step={usd ? 'any' : '1'}
        required
        placeholder={usd ? '$' : "so'm"}
        value={value || ''}
        onChange={(e) => setValue(Number(e.target.value))}
        className={inputClass}
      />
    );
  };

  const currencyBar = () => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] lg:col-span-2">
      <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-black">
        Narx birligi: {priceCurrency === 'USD' ? 'AQSH dollari ($)' : "so'm (UZS)"}
      </span>
      <span className="text-stone-500">Narxlarni bitta dona uchun kiriting.</span>
    </div>
  );

  const handleChangeDraftQuantity = (index: number, value: number) => {
    const quantityValue = Number.isSafeInteger(value) && value > 0 ? value : 0;
    setDraftItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: quantityValue } : item)));
  };

  const handleClearDraft = () => {
    if (draftItems.length > 0 && window.confirm("Kirim ro'yxatidagi barcha tovarlar o'chirilsinmi?")) setDraftItems([]);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if ((draftItems.length > 0 || markedProducts.length > 0) && !window.confirm("Kirim ro'yxati saqlanmagan. Oynani yopsangiz, kiritilgan ro'yxat bekor bo'ladi. Baribir yopilsinmi?")) return;
    onClose();
  };

  const handleCloseNewProduct = () => {
    if (newProductName.trim() && !window.confirm("Yangi tovar ma'lumotlari saqlanmagan. Oynani yopaymi?")) return;
    setIsCreatingNew(false);
  };

  const handleAddProducts = (selected: Product[]) => {
    setDraftItems((prev) => selected.reduce((items, product) => {
      const currency = currencyOf(product);
      return addDraftItem(items, {
        product, currency, quantity: 1,
        unitCost: product.purchasePrice,
        wholesalePrice: product.wholesalePrice ?? roundMoney(product.sellingPrice * 0.8, currency),
        unitPrice: product.sellingPrice
      });
    }, prev));
    setMarkedProducts([]);
    setProductSearch('');
    searchInputRef.current?.focus();
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const currencyGroups = (['UZS', 'USD'] as const).flatMap((currency) => {
    const items = draftItems.filter((item) => item.currency === currency);
    if (!items.length) return [];
    const total = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), currency);
    const paid = paymentType === 'paid' ? total
      : paymentType === 'debt' ? 0
      : roundMoney(Math.min(total, Math.max(0, paidAmount[currency] ?? 0)), currency);
    return [{ currency, items, total, paid, remaining: roundMoney(total - paid, currency) }];
  });
  const formattedTotals = currencyGroups.map(({ currency, total }) => formatMoney(total, currency)).join(' + ')
    || formatMoney(0, priceCurrency);
  const formattedDebt = currencyGroups.filter(({ remaining }) => remaining > 0)
    .map(({ currency, remaining }) => formatMoney(remaining, currency)).join(' + ');
  const totalItemsCount = draftItems.reduce((sum, item) => sum + item.quantity, 0);

  const hasMissingQuantity = draftItems.some((item) => item.quantity < 1);
  const hasMissingDetails = draftItems.some(({ product }) => !product.name.trim() || !product.category.trim());
  const canSubmit = !hasMissingDetails && !isSubmitting && draftItems.length > 0 && !!supplier.trim() && !markedProducts.length && !hasMissingQuantity;

  const handleSubmitInvoice = async () => {
    if (!canSubmit) return;
    if (draftItems.some(({ unitCost, unitPrice }) => unitCost <= 0 || unitPrice <= 0)) {
      alert('Ro‘yxatdagi barcha tovarlarning kirim va chakana narxini kiriting.');
      return;
    }
    if (draftItems.some(({ unitCost, unitPrice }) => unitPrice < unitCost) &&
      !window.confirm('Ayrim tovarlarning chakana narxi kirim narxidan past. Kirimni tasdiqlaysizmi?')) return;

    if (onSubmitWorkerKirim) {
      setIsSubmitting(true);
      try {
        await onSubmitWorkerKirim({
          supplier: supplier.trim(),
          supplierPhone: supplierPhone.trim(),
          notes: notes.trim(),
          dueDate: debtDueDate,
          groups: currencyGroups.map(({ items, paid }) => ({
            paidAmount: paid,
            items: items.map(({ product, quantity, unitCost, unitPrice, wholesalePrice }) => ({
              productId: product.id, name: product.name.trim(), category: product.category.trim(), quantity, unitCost, sellingPrice: unitPrice, wholesalePrice
            }))
          }))
        });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Kirim saqlanmadi.');
        return;
      } finally {
        setIsSubmitting(false);
      }
    } else {
      for (const { items, paid, remaining } of currencyGroups) {
        onConfirmKirim(items, supplier.trim(), notes.trim(), remaining > 0 ? {
          isDebt: true,
          paidAmount: paid,
          remainingAmount: remaining,
          supplierPhone: supplierPhone.trim() || undefined,
          dueDate: debtDueDate || undefined
        } : undefined);
      }
    }

    setDraftItems([]);
    setNotes('');
    setPaidAmount({});
    setPaymentType('paid');
    alert(formattedDebt
      ? `Kirim omborga qo‘shildi. Ta’minotchi qarzi: ${formattedDebt}.`
      : 'Tovarlar omborga qo‘shildi!');
  };

  // Handle new accessory creation
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddNewProductDirect || !newProductName.trim()) return;
    const quantity = Number(newProductQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      alert('Tovar sonini musbat butun raqam bilan kiriting.');
      return;
    }
    if (effectiveUnitCost <= 0 || effectiveRetail <= 0) {
      alert('Tan narxi va chakana narxni kiriting!');
      return;
    }

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newProductName.trim(),
      category: newProductCategory,
      brand: newProductBrand.trim() || 'Universal',
      barcode: `${Math.floor(100000 + Math.random() * 900000)}`,
      currency: priceCurrency,
      purchasePrice: effectiveUnitCost,
      wholesalePrice: effectiveWholesale || Math.round(effectiveRetail * 0.8),
      sellingPrice: effectiveRetail,
      stock: 0,
      minStockAlert: 5
    };

    onAddNewProductDirect(newProd);
    setDraftItems((prev) => addDraftItem(prev, {
      product: newProd, currency: priceCurrency, quantity,
      unitCost: effectiveUnitCost, wholesalePrice: newProd.wholesalePrice, unitPrice: effectiveRetail
    }));
    setIsCreatingNew(false);
    setNewProductName('');
    setNewProductQuantity('');
  };

  return (
    <div className="fixed inset-0 z-[120] bg-stone-950/70 backdrop-blur-sm p-0 sm:p-3 lg:p-5" role="dialog" aria-modal="true" aria-labelledby="kirim-modal-title">
      <div className="mx-auto flex h-full w-full max-w-[1700px] flex-col overflow-hidden bg-stone-50 shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 id="kirim-modal-title" className="text-lg font-black text-stone-950 sm:text-xl">Tovar kirimini rasmiylashtirish</h1>
            <p className="mt-0.5 text-xs text-stone-500">Tovarlarni belgilang → ro‘yxatga qo‘shing → miqdor va narxlarni tekshiring.</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Tovar kirimi oynasini yopish" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-300 px-3 text-sm font-bold text-stone-700 hover:bg-stone-100">
            <X className="h-4 w-4" /> <span className="hidden sm:inline">Yopish</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-[1600px] space-y-5 pb-8">
      {!onSubmitWorkerKirim && <details className="group">
        <summary className="w-fit cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100">
          Qo‘shimcha amallar
        </summary>
        <div className="mt-2">
      <div className="bg-emerald-900 text-white rounded-3xl p-4 sm:p-6 shadow-lg border border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Omborga tovar qabul qilish</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Omborga yangi tovar qo‘shish
          </h2>
          <p className="hidden sm:block text-xs sm:text-sm text-emerald-200/90 max-w-xl">
            Tovarni ro‘yxatga kiriting, miqdor va narxlarini belgilang. Ombor qoldig‘i faqat yakuniy tasdiqdan keyin o‘zgaradi.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {onOpenPhotoKirim && (
              <button
                type="button"
                onClick={onOpenPhotoKirim}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer transition-all hover:scale-[1.02] border border-amber-300/80"
                title="Hisob-faktura yoki daftar rasmini AI bilan o‘qib kirim qilish"
              >
                <Camera className="w-4 h-4 text-stone-950" />
                <span>📸 Hujjatdan kirim (AI)</span>
              </button>
            )}

            {onOpenExcelImport && (
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Excel (.xlsx, .csv) fayl orqali tovarlarni ommaviy yuklash"
              >
                <FileSpreadsheet className="w-4 h-4 text-stone-950" />
                <span>📥 Excel / CSV Ommaviy Kirim</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-800/90 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-600/60 shadow-xs cursor-pointer transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-amber-300" />
              <span>🏷️ Kataloglar ({categories.length})</span>
            </button>

            {onNavigateToSupplierDebts && (
              <button
                type="button"
                onClick={onNavigateToSupplierDebts}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Truck className="w-3.5 h-3.5 text-stone-950" />
                <span>🚚 Ta'minotchi Qarzlar Paneli</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-700/60 z-10 text-right min-w-[200px]">
          <div className="text-[11px] text-emerald-300 font-semibold uppercase">
            Kiritilayotgan tovarlar qiymati:
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formattedTotals}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-0.5">
            {totalItemsCount} dona aksessuar
          </div>
        </div>
      </div>

        </div>
      </details>}

      <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Ta’minotchi *
          <input
            list="kirim-suppliers"
            value={supplier}
            onChange={(e) => { setSupplier(e.target.value); setSupplierPhone(''); }}
            placeholder="Ro‘yxatdan tanlang yoki yangi nom yozing"
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <datalist id="kirim-suppliers">
            {supplierNames.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
        <label className="block text-sm font-bold">
          Tovar valyutasi
          <select
            value={currencyChoice ?? ""}
            onChange={(e) => {
              setCurrencyChoice(e.target.value ? e.target.value as Currency : undefined);

            }}
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
          >
            <option value="">Tovarga qarab avtomatik</option>
            <option value="UZS">So‘m (UZS)</option>
            <option value="USD">Dollar (USD)</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Valyutani tanlasangiz, qidiruv shu valyutadagi tovarlarni ko‘rsatadi.
          </span>
        </label>
      </div>

      {/* Main Grid: Add Item Form + Invoice List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Select & Enter values (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>1-qadam · Tovar, miqdor va narx</span>
            </h3>
            {onAddNewProductDirect && (
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-xs sm:text-sm text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingNew ? 'Ro\'yxatdan tanlash' : 'Yangi tovar yaratish'}</span>
            </button>
            )}
          </div>

          {/* If creating new product */}
          {isCreatingNew ? (
            <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-stone-950/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="new-product-title">
            <form onSubmit={handleCreateNewProduct} className="my-auto w-full max-w-5xl space-y-6 rounded-3xl border border-emerald-200 bg-white p-5 shadow-2xl sm:p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-5">
                <div>
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">1-QADAM · KATALOG</span>
                  <h2 id="new-product-title" className="mt-3 text-2xl font-black text-stone-950 sm:text-3xl">Yangi tovar kartochkasi</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">Tovar nomi, katalogi, soni va bir dona narxlarini kiriting. Saqlangach, tovar belgilangan miqdorda kirim ro‘yxatiga qo‘shiladi.</p>
                </div>
                <button type="button" onClick={handleCloseNewProduct} aria-label="Yangi tovar oynasini yopish" className="shrink-0 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">✕ <span className="hidden sm:inline">Yopish</span></button>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-800">
                  Tovar to'liq nomi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: iPhone 16 Pro Max Maxfiy Oyna"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-sm font-bold text-stone-800">Kategoriya / Katalog *</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingCat(!isInlineAddingCat)}
                        className="flex cursor-pointer items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Yangi katalog</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="flex cursor-pointer items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800"
                        title="Kataloglarni boshqarish & tahrirlash"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Tahrirlash</span>
                      </button>
                    </div>
                  </div>

                  {isInlineAddingCat ? (
                    <div className="space-y-1 mb-2 bg-white p-2 border border-emerald-300 rounded-xl">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Yangi katalog nomi (masalan: Smart Soatlar)..."
                          value={inlineCatName}
                          onChange={(e) => setInlineCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddInlineCategory();
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddInlineCategory}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Qo'shish
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsInlineAddingCat(false);
                            setInlineCatName('');
                          }}
                          className="px-2 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs rounded-lg cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-500">Yangi katalog ro'yxatga qo'shiladi va tanlanadi.</p>
                    </div>
                  ) : (
                    <select
                      value={newProductCategory}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsInlineAddingCat(true);
                        } else if (e.target.value === '__manage__') {
                          setIsCategoryModalOpen(true);
                        } else {
                          setNewProductCategory(e.target.value);
                          setCurrencyChoice(undefined);
                        }
                      }}
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option disabled>──────────────</option>
                      <option value="__add_new__">+ Yangi katalog yaratish...</option>
                      <option value="__manage__">⚙️ Kataloglarni boshqarish / tahrirlash...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-800">Brend</label>
                  <input
                    type="text"
                    placeholder="Remax, Hoco, Baseus, Universal..."
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <label className="block text-sm font-bold text-stone-800">
                  Soni (dona) *
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={newProductQuantity}
                    onChange={(e) => setNewProductQuantity(e.target.value)}
                    placeholder="Nechta tovar keldi?"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                  <label className="block text-sm font-bold">
                    Narx valyutasi
                    <select
                      value={priceCurrency}
                      onChange={(e) => setCurrencyChoice(e.target.value as Currency)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                    >
                      <option value="UZS">So‘m (UZS)</option>
                      <option value="USD">Dollar (USD)</option>
                    </select>
                  </label>
                {currencyBar()}
                <div className="grid grid-cols-1 gap-4 border-t border-stone-200 pt-5 sm:grid-cols-3 lg:col-span-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-stone-700">
                      1 dona kirim narxi *
                    </label>
                    {priceField('cost', 'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500')}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-blue-700">
                      1 dona ulgurji narxi *
                    </label>
                    {priceField('wholesale', 'w-full rounded-xl border border-blue-300 bg-blue-50/60 px-4 py-3 text-base font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500')}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-stone-700">
                      1 dona chakana narxi *
                    </label>
                    {priceField('retail', 'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500')}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={handleCloseNewProduct} className="rounded-xl border border-stone-300 px-6 py-3 text-sm font-bold text-stone-700 hover:bg-stone-100">Bekor qilish</button>
                <button type="submit" className="rounded-xl bg-emerald-700 px-8 py-3 text-sm font-black text-white shadow-md hover:bg-emerald-800">Saqlash va kirim ro‘yxatiga qo‘shish</button>
              </div>
            </form>
            </div>
          ) : (
            <KirimProductPicker
              products={currencyChoice ? products.filter((p) => currencyOf(p) === currencyChoice) : products}
              query={productSearch}
              onQueryChange={setProductSearch}
              lastKirim={lastKirim}
              marked={markedProducts}
              onToggle={(product) => setMarkedProducts((prev) => prev.some((p) => p.id === product.id)
                ? prev.filter((p) => p.id !== product.id)
                : [...prev, product])}
              onAddMarked={() => handleAddProducts(markedProducts)}
              inputRef={searchInputRef}
            />
          )}

          {/* Supplier and Notes */}
          <div className="border-t border-stone-100 pt-3 space-y-2 text-xs">
            <div className="font-black text-stone-900">Ta’minotchi haqida</div>
            <p className="text-[11px] text-stone-500">Kirim qayerdan kelganini qayd eting. Telefon va izoh ixtiyoriy.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Telefon raqami (Ixtiyoriy):
                </label>
                <input
                  type="text"
                  placeholder="+998 90 123 45 67"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Izoh yoki Partiya raqami:
              </label>
              <input
                type="text"
                placeholder="Masalan: Fevral oyining 2-partiyasi"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right Form: Current Receiving Invoice (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>2-qadam · Kirim ro‘yxati</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Ta'minotchi: <strong className="text-stone-700">{supplier}</strong>
              </p>
            </div>
            <span className="text-xs font-bold bg-stone-100 px-2.5 py-1 rounded-lg text-stone-700">
              {draftItems.length} ta pozitsiya
              {draftItems.length > 0 && (
                <button type="button" onClick={handleClearDraft} className="ml-2 text-red-600 hover:underline cursor-pointer">
                  Tozalash
                </button>
              )}
            </span>
          </div>

          {/* Items list */}
          <div className="flex-1 min-h-[220px] max-h-[55vh] overflow-y-auto divide-y divide-stone-100">
            {draftItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-2">
                <Package className="w-10 h-10 stroke-1 text-stone-300" />
                <div className="text-xs font-semibold text-stone-600">
                  Hozircha ro‘yxat bo‘sh
                </div>
                <div className="text-[11px] text-stone-400 max-w-xs">
                  Chapda tovarlarni qidiring, belgilang va birgalikda ro‘yxatga qo‘shing. Ombor qoldig‘i tasdiqlamaguningizcha o‘zgarmaydi.
                </div>
              </div>
            ) : (
              draftItems.map((item, index) => (
                <div key={index} className="py-2.5 flex flex-wrap items-center justify-between text-xs gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="text-[11px] text-stone-600">
                        Tovar nomi
                        <input
                          type="text"
                          value={item.product.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setDraftItems((prev) => prev.map((row, i) => i === index
                              ? { ...row, product: { ...row.product, name } }
                              : row));
                          }}
                          className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 px-2 py-1.5 font-bold text-stone-900 focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <label className="text-[11px] text-stone-600">
                        Katalog
                        <select
                          value={item.product.category}
                          onChange={(e) => {
                            const category = e.target.value;
                            setDraftItems((prev) => prev.map((row, i) => i === index
                              ? { ...row, product: { ...row.product, category } }
                              : row));
                          }}
                          className="mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 py-1.5 font-semibold text-stone-900"
                        >
                          {[...new Set([item.product.category, ...categories])].filter(Boolean).map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      {([
                        ['unitCost', 'Kirim'],
                        ['wholesalePrice', 'Ulgurji'],
                        ['unitPrice', 'Chakana']
                      ] as const).map(([field, label]) => (
                        <label key={field} className="text-[11px] text-stone-600">
                          {label} ({item.currency === 'USD' ? '$' : 'so‘m'})
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item[field] || ''}
                            onChange={(e) => {
                              const value = Math.max(0, Number(e.target.value));
                              setDraftItems((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
                            }}
                            className="block w-full min-w-0 rounded-lg border border-stone-300 px-1.5 py-1 font-semibold"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleChangeDraftQuantity(index, Math.max(1, item.quantity - 1))}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                      aria-label="Miqdorni kamaytirish"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ''}
                      inputMode="numeric"
                      aria-invalid={!item.quantity}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => handleChangeDraftQuantity(index, Number(e.target.value))}
                      className="w-14 px-1 py-1 text-center text-xs font-black border border-stone-300 rounded-lg"
                      aria-label="Miqdor"
                    />
                    <button
                      type="button"
                      onClick={() => handleChangeDraftQuantity(index, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                      aria-label="Miqdorni oshirish"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-stone-900">
                      {formatMoney(roundMoney(item.quantity * item.unitCost, item.currency), item.currency)}
                    </div>
                    <button
                      onClick={() => handleRemoveDraftItem(index)}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Invoice Summary & Submit */}
          <div className="border-t border-stone-200 pt-4 space-y-3">
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-500 font-medium">Jami Kirim Qiymati:</span>
                <div className="text-xl font-black text-stone-900">
                  {formattedTotals}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-500 font-medium">Jami dona:</span>
                <div className="text-base font-bold text-stone-800">
                  {totalItemsCount} ta
                </div>
              </div>
            </div>

            {/* Supplier Debt & Payment Terms */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>3-qadam · Ta’minotchiga to‘lov</span>
                </div>
                {paymentType !== 'paid' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                    Qarzga olinmoqda
                  </span>
                )}
              </div>

              <p className="text-[11px] text-stone-500">Kirim pulini to‘liq, qisman yoki keyin to‘lashni tanlang.</p>
              {/* Payment Type Selector */}
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentType('paid')}
                  className={`py-2 px-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                    paymentType === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-[11px]">To'liq to'landi</div>
                  <div className="text-[9px] opacity-80 font-normal">Qarz yo'q</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('partial')}
                  className={`py-2 px-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                    paymentType === 'partial'
                      ? 'bg-amber-400 text-stone-950 border-amber-400 shadow-2xs font-black'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-[11px]">Qisman to'landi</div>
                  <div className="text-[9px] opacity-80 font-normal">Avans berildi</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('debt');
                    setPaidAmount({});
                  }}
                  className={`py-2 px-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                    paymentType === 'debt'
                      ? 'bg-red-500 text-white border-red-500 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-[11px]">100% Nasiya</div>
                  <div className="text-[9px] opacity-80 font-normal">Hozir to'lanmadi</div>
                </button>
              </div>

              {/* Partial payment amount input */}
              {paymentType === 'partial' && currencyGroups.map(({ currency, total }) => (
                <label key={currency} className="block space-y-1 font-semibold text-stone-700">
                  To‘langan summa ({currency === 'USD' ? '$' : 'so‘m'})
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step={currency === 'USD' ? '0.01' : '1'}
                    value={paidAmount[currency] ?? ''}
                    onChange={(e) => setPaidAmount((prev) => ({ ...prev, [currency]: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                  />
                </label>
              ))}

              {/* Debt Due Date if partial or full debt */}
              {paymentType !== 'paid' && (
                <div className="pt-1 space-y-2 border-t border-stone-200/60">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-stone-700 text-[11px] mb-1">
                        Qarzni to'lash muddati:
                      </label>
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div className="bg-red-50 p-2 rounded-xl border border-red-200 flex flex-col justify-center">
                      <span className="text-[10px] text-red-600 font-medium">Ta'minotchiga qarz:</span>
                      <span className="text-xs font-black text-red-700 truncate">
                        {formattedDebt || formatMoney(0, priceCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {hasMissingQuantity && (
              <p className="text-xs font-semibold text-red-700">Har bir tovar uchun miqdorni kiriting.</p>
            )}
            <button
              onClick={handleSubmitInvoice}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                canSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {formattedDebt ? `Kirimni tasdiqlash · qarz ${formattedDebt}` : "Kirimni tasdiqlab omborga qo‘shish"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Received Goods Log */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
        <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-500" />
          <span>Oxirgi Qabul Qilingan Tovar Kirimlari Tarixi</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Sana / Vaqt</th>
                <th className="py-2.5 px-3">Tovar Nomi</th>
                <th className="py-2.5 px-3 text-center">Miqdori</th>
                <th className="py-2.5 px-3 text-right">Tan Narxi</th>
                <th className="py-2.5 px-3 text-right">Jami Qiymat</th>
                <th className="py-2.5 px-3">Ta'minotchi</th>
                <th className="py-2.5 px-3">Izoh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentKirimMovements.slice(0, 8).map((m) => (
                <tr key={m.id} className="hover:bg-stone-50/60">
                  <td className="py-2.5 px-3 text-stone-400 whitespace-nowrap">
                    {formatDate(m.timestamp)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-stone-900">
                    {m.productName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black text-blue-700">
                    +{m.quantity} ta
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-700">
                    {formatMoney(m.unitCost, currencyOf(m))}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-stone-900">
                    {formatMoney(m.totalCost, currencyOf(m))}
                  </td>
                  <td className="py-2.5 px-3 text-stone-600">
                    {m.counterparty}
                  </td>
                  <td className="py-2.5 px-3 text-stone-400 text-[11px]">
                    {m.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          products={products}
          onAddCategory={(cat) => (onAddCategory ? onAddCategory(cat) : false)}
          onEditCategory={(oldN, newN) => (onEditCategory ? onEditCategory(oldN, newN) : false)}
          onDeleteCategory={(cat) => (onDeleteCategory ? onDeleteCategory(cat) : false)}
          onClose={() => setIsCategoryModalOpen(false)}
          onSelectCategory={(cat) => {
            setNewProductCategory(cat);
            setCurrencyChoice(undefined);
          }}
        />
      )}
      </div>
        </div>
      </div>
    </div>
  );
};
