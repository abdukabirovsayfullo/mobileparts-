import React, { useState, useMemo } from 'react';
import { Product, StockMovement } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import { CategoryManagerModal } from './CategoryManagerModal';
import { searchProducts } from '../utils/productSearch';
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
  Camera
} from 'lucide-react';

interface KirimFormViewProps {
  products: Product[];
  categories?: string[];
  recentKirimMovements: StockMovement[];
  onConfirmKirim: (
    items: {
      product: Product;
      quantity: number;
      unitCost: number;
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
  onAddNewProductDirect: (product: Product) => void;
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
  wholesalePrice?: number;
  unitPrice: number;
}

export const KirimFormView: React.FC<KirimFormViewProps> = ({
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
  onConfirmKirim,
  onAddNewProductDirect,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onNavigateToSupplierDebts,
  onOpenExcelImport,
  onOpenPhotoKirim
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [quantity, setQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(
    products[0]?.purchasePrice || 45000
  );
  const [wholesalePrice, setWholesalePrice] = useState<number>(
    products[0]?.wholesalePrice || Math.round((products[0]?.sellingPrice || 85000) * 0.8)
  );
  const [unitPrice, setUnitPrice] = useState<number>(
    products[0]?.sellingPrice || 85000
  );
  const [supplier, setSupplier] = useState<string>('Andijon Ulgurji Baza');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('Yangi partiya tovar');

  // Supplier Payment terms
  const [paymentType, setPaymentType] = useState<'paid' | 'partial' | 'debt'>('paid');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [debtDueDate, setDebtDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
  );

  // Draft invoice items
  const [draftItems, setDraftItems] = useState<KirimDraftItem[]>([]);

  // Search filter for dropdown
  const [productSearch, setProductSearch] = useState('');

  // New product inline creation
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState(categories[0] || 'Chexollar');
  const [newProductBrand, setNewProductBrand] = useState('Universal');

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
        setInlineCatName('');
        setIsInlineAddingCat(false);
      } else {
        alert(`"${trimmed}" katalogi allaqachon mavjud!`);
      }
    } else {
      setNewProductCategory(trimmed);
      setInlineCatName('');
      setIsInlineAddingCat(false);
    }
  };

  const filteredDropdownProducts = useMemo(() => {
    const categoryProducts = selectedCategoryFilter === 'all' ? products : products.filter(p => p.category === selectedCategoryFilter);
    return searchProducts(categoryProducts, productSearch);
  }, [products, selectedCategoryFilter, productSearch]);

  // When selected product changes
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const found = products.find((p) => p.id === prodId);
    if (found) {
      setUnitCost(found.purchasePrice);
      setWholesalePrice(found.wholesalePrice || Math.round(found.sellingPrice * 0.8));
      setUnitPrice(found.sellingPrice);
    }
  };

  const handleAddDraftItem = (e: React.FormEvent) => {
    e.preventDefault();
    const found = products.find((p) => p.id === selectedProductId);
    if (!found) return;
    if (quantity <= 0 || unitCost <= 0) {
      alert('Miqdor va tan narxini to\'g\'ri kiriting!');
      return;
    }

    setDraftItems((prev) => [
      ...prev,
      {
        product: found,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        wholesalePrice: Number(wholesalePrice) || Math.round(Number(unitPrice) * 0.8),
        unitPrice: Number(unitPrice)
      }
    ]);

    // Reset draft fields for next item
    setQuantity(10);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const grandTotalCost = draftItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );
  const totalItemsCount = draftItems.reduce((sum, item) => sum + item.quantity, 0);

  const effectivePaidAmount = useMemo(() => {
    if (paymentType === 'paid') return grandTotalCost;
    if (paymentType === 'debt') return 0;
    return Math.min(grandTotalCost, Math.max(0, paidAmount));
  }, [paymentType, grandTotalCost, paidAmount]);

  const effectiveDebtRemaining = useMemo(() => {
    return Math.max(0, grandTotalCost - effectivePaidAmount);
  }, [grandTotalCost, effectivePaidAmount]);

  const handleSubmitInvoice = () => {
    if (draftItems.length === 0) {
      alert('Iltimos, avval kirim qilinadigan tovarlarni ro\'yxatga qo\'shing!');
      return;
    }

    const isDebtCase = paymentType !== 'paid' && effectiveDebtRemaining > 0;

    onConfirmKirim(
      draftItems, 
      supplier.trim() || 'Ulgurji Ta\'minotchi', 
      notes.trim(),
      isDebtCase
        ? {
            isDebt: true,
            paidAmount: effectivePaidAmount,
            remainingAmount: effectiveDebtRemaining,
            supplierPhone: supplierPhone.trim() || undefined,
            dueDate: debtDueDate || undefined
          }
        : undefined
    );

    setDraftItems([]);
    setPaidAmount(0);
    setPaymentType('paid');

    if (isDebtCase) {
      alert(
        `Tovar kirimi omborga qabul qilindi! Ta'minotchidan ${formatMoney(effectiveDebtRemaining)} so'm qarzga olingani Ta'minotchi Qarz Daftariga kiritildi.`
      );
    } else {
      alert('Tovar kirimi muvaffaqiyatli qabul qilindi va omborga qo\'shildi!');
    }
  };

  // Direct quick single item receive
  const handleQuickSingleReceive = () => {
    const found = products.find((p) => p.id === selectedProductId);
    if (!found || quantity <= 0 || unitCost <= 0) return;

    onConfirmKirim(
      [
        {
          product: found,
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          wholesalePrice: Number(wholesalePrice) || Math.round(Number(unitPrice) * 0.8),
          unitPrice: Number(unitPrice)
        }
      ],
      supplier.trim() || 'Ulgurji Ta\'minotchi',
      notes.trim()
    );

    alert(`"${found.name}" dan ${quantity} dona omborga kiritildi!`);
  };

  // Handle new accessory creation
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: newProductName.trim(),
      category: newProductCategory,
      brand: newProductBrand.trim() || 'Universal',
      barcode: `${Math.floor(100000 + Math.random() * 900000)}`,
      purchasePrice: Number(unitCost),
      wholesalePrice: Number(wholesalePrice) || Math.round(Number(unitPrice) * 0.8),
      sellingPrice: Number(unitPrice),
      stock: 0,
      minStockAlert: 5
    };

    onAddNewProductDirect(newProd);
    setSelectedProductId(newProd.id);
    setIsCreatingNew(false);
    setNewProductName('');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Omborga Tovar Qabul Qilish (Prikhod)</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Yangi Tovar Kirimi
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/90 max-w-xl">
            Ta'minotchidan yoki ulgurji bazadan yangi aksessuarlar kelganda kirim qiling. Tan narxi, sotish narxi va miqdori darhol omborga yoziladi.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {onOpenPhotoKirim && (
              <button
                type="button"
                onClick={onOpenPhotoKirim}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer transition-all hover:scale-[1.02] border border-amber-300/80"
                title="AI Agent (Gemini) orqali Nakladnoy yoki daftar yozuvini rasmga olib avtomatik kirim qilish"
              >
                <Camera className="w-4 h-4 text-stone-950" />
                <span>📸 AI Foto Kirim (Kamera)</span>
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
            Joriy Nakladnoy Summasi:
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formatMoney(grandTotalCost)}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-0.5">
            {totalItemsCount} dona aksessuar
          </div>
        </div>
      </div>

      {/* Main Grid: Add Item Form + Invoice List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Select & Enter values (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>1. Tovarni Tanlash &amp; Narxlari</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreatingNew ? 'Ro\'yxatdan tanlash' : 'Yangi tovar yaratish'}</span>
            </button>
          </div>

          {/* If creating new product */}
          {isCreatingNew ? (
            <form onSubmit={handleCreateNewProduct} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 text-xs">
              <div className="font-bold text-emerald-950 text-xs flex items-center justify-between">
                <span>Yangi Aksessuar Kartochkasi:</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">Katalogga kiritish</span>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Tovar to'liq nomi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: iPhone 16 Pro Max Maxfiy Oyna"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-stone-700">Kategoriya / Katalog *</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingCat(!isInlineAddingCat)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Yangi katalog</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[11px] font-bold text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
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
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-stone-900"
                    >
                      {categories.map((cat) => (
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
                  <label className="block font-semibold text-stone-700 mb-1">Brend</label>
                  <input
                    type="text"
                    placeholder="Remax, Hoco, Baseus, Universal..."
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                      Tan narxi *
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      required
                      value={unitCost}
                      onChange={(e) => setUnitCost(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-blue-700 mb-1 text-[11px]">
                      Optom narx *
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      required
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-blue-50/60 border border-blue-300 rounded-xl font-bold text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                      Chakana narx *
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Katalogga Saqlash va Kirimga Olish
              </button>
            </form>
          ) : (
            <div className="space-y-3.5 text-xs">
              {/* Category Filter + Search for fast warehouse product selection */}
              <div className="space-y-1.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-700 flex items-center gap-1 text-[11px]">
                    <Filter className="w-3.5 h-3.5 text-stone-500" />
                    <span>Katalog bo'yicha filter:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Kataloglarni tahrirlash</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => {
                      setSelectedCategoryFilter(e.target.value);
                    }}
                    className="w-1/2 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">Barcha kataloglar ({products.length} ta)</option>
                    {categories.map((cat) => {
                      const count = products.filter((p) => p.category === cat).length;
                      return (
                        <option key={cat} value={cat}>
                          {cat} ({count})
                        </option>
                      );
                    })}
                  </select>

                  <div className="w-1/2 relative">
                    <input
                      type="text"
                      placeholder="Nomi yoki shtrix-kod..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-stone-900"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        className="absolute right-2 top-2 text-stone-400 hover:text-stone-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Katalogdagi Tovar * ({filteredDropdownProducts.length} ta mos keldi)
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 text-stone-900"
                >
                  {filteredDropdownProducts.length === 0 ? (
                    <option value="">Mos tovar topilmadi ("Yangi tovar yaratish"ni bosing)</option>
                  ) : (
                    filteredDropdownProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.category}] {p.name} (Qoldiq: {p.stock} ta)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Miqdori (dona) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-center text-stone-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Tan Narxi *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-blue-700 mb-1 text-[11px]">
                    Optom Narx *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-blue-50/60 border border-blue-300 rounded-xl font-bold text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Chakana Narx *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAddDraftItem}
                  className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nakladnoyga qo'shish</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickSingleReceive}
                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
                  title="Nakladnoy tuzmasdan darhol omborga kiritish"
                >
                  Tezkor Kirim
                </button>
              </div>
            </div>
          )}

          {/* Supplier and Notes */}
          <div className="border-t border-stone-100 pt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Ta'minotchi / Baza nomi:
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Toshkent Abu Saxiy..."
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>

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
                <span>2. Qabul Qilinayotgan Nakladnoy Ro'yxati</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Ta'minotchi: <strong className="text-stone-700">{supplier}</strong>
              </p>
            </div>
            <span className="text-xs font-bold bg-stone-100 px-2.5 py-1 rounded-lg text-stone-700">
              {draftItems.length} ta pozitsiya
            </span>
          </div>

          {/* Items list */}
          <div className="flex-1 min-h-[220px] max-h-[350px] overflow-y-auto divide-y divide-stone-100">
            {draftItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-2">
                <Package className="w-10 h-10 stroke-1 text-stone-300" />
                <div className="text-xs font-semibold text-stone-600">
                  Hozircha nakladnoyga tovar qo'shilmadi
                </div>
                <div className="text-[11px] text-stone-400 max-w-xs">
                  Chap tarafdan tovar, miqdor va tan narxini tanlab "Nakladnoyga qo'shish" tugmasini bosing.
                </div>
              </div>
            ) : (
              draftItems.map((item, index) => (
                <div key={index} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span>{item.quantity} dona × Tan: <strong className="text-stone-700">{formatMoney(item.unitCost)}</strong></span>
                      <span>•</span>
                      <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Optom: {formatMoney(item.wholesalePrice || Math.round(item.unitPrice * 0.8))}</span>
                      <span>•</span>
                      <span className="text-stone-700 font-bold bg-stone-100 px-1.5 py-0.5 rounded">Chakana: {formatMoney(item.unitPrice)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-stone-900">
                      {formatMoney(item.quantity * item.unitCost)}
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
                  {formatMoney(grandTotalCost)}
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
                  <span>Ta'minotchi To'lov Holati (Qarz / Nasiya)</span>
                </div>
                {paymentType !== 'paid' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                    Qarzga olinmoqda
                  </span>
                )}
              </div>

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
                  onClick={() => {
                    setPaymentType('partial');
                    if (paidAmount === 0 && grandTotalCost > 0) {
                      setPaidAmount(Math.round(grandTotalCost / 2 / 1000) * 1000);
                    }
                  }}
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
                    setPaidAmount(0);
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
              {paymentType === 'partial' && (
                <div className="pt-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-stone-700 text-[11px]">
                      Hozir berilgan avans summasi (so'm):
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(Math.round(grandTotalCost / 2 / 1000) * 1000)}
                      className="text-[10px] text-amber-800 font-bold hover:underline"
                    >
                      50% berildi
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={grandTotalCost}
                    step="1000"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    placeholder="Masalan: 500000"
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

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
                        {formatMoney(effectiveDebtRemaining)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitInvoice}
              disabled={draftItems.length === 0}
              className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                draftItems.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {paymentType === 'paid' 
                  ? "Kirimni Tasdiqlash va Omborga Qo'shish"
                  : `Kirimni Qabul Qilish (Qarz: ${formatMoney(effectiveDebtRemaining)})`}
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
                    {formatMoney(m.unitCost)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-stone-900">
                    {formatMoney(m.totalCost)}
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
            setSelectedCategoryFilter(cat);
          }}
        />
      )}
    </div>
  );
};
