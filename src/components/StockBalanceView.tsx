import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { formatMoney, downloadCSV } from '../utils/formatters';
import { CategoryManagerModal } from './CategoryManagerModal';
import { searchProducts } from '../utils/productSearch';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  Download, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  X, 
  CheckCircle2, 
  ArrowDownLeft, 
  Filter, 
  Tag, 
  FolderPlus,
  Lock,
  KeyRound,
  FileSpreadsheet,
  FileText,
  Sparkles
} from 'lucide-react';

interface StockBalanceViewProps {
  products: Product[];
  categories?: string[];
  isAdminUnlocked?: boolean;
  onRequireUnlock?: () => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onQuickKirimForProduct: (product: Product) => void;
  onClearZeroStockProducts?: () => void;
  onAddCategory?: (categoryName: string) => boolean;
  onEditCategory?: (oldName: string, newName: string) => boolean;
  onDeleteCategory?: (categoryName: string) => boolean;
  onOpenExcelImport?: () => void;
  onOpenPdfReports?: (reportType?: 'out_of_stock' | 'stock_inventory') => void;
  onNavigateToAiAnalyst?: () => void;
}

export const StockBalanceView: React.FC<StockBalanceViewProps> = ({
  products,
  categories: propCategories,
  isAdminUnlocked = false,
  onRequireUnlock,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onQuickKirimForProduct,
  onClearZeroStockProducts,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onOpenExcelImport,
  onOpenPdfReports,
  onNavigateToAiAnalyst
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'critical3' | 'low' | 'zero'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Category Manager Modal state
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isInlineAddingCat, setIsInlineAddingCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  const availableCategories = useMemo(() => {
    if (propCategories && propCategories.length > 0) return propCategories;
    const existing = Array.from(new Set(products.map((p) => p.category)));
    return existing.length > 0
      ? existing
      : [
          'Chexollar',
          'Himoya Oynalari',
          'Zaryadniklar',
          'Kabellar',
          'Quloqchinlar',
          'Powerbanklar',
          'Avto Aksessuarlar',
          'Beeline Xizmatlari',
          'Gadjetlar'
        ];
  }, [propCategories, products]);

  const handleQuickAddInlineCategory = () => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) return;
    if (onAddCategory) {
      const ok = onAddCategory(trimmed);
      if (ok) {
        setFormData((prev) => ({ ...prev, category: trimmed }));
        setInlineCatName('');
        setIsInlineAddingCat(false);
      } else {
        alert(`"${trimmed}" katalogi allaqachon mavjud!`);
      }
    } else {
      setFormData((prev) => ({ ...prev, category: trimmed }));
      setInlineCatName('');
      setIsInlineAddingCat(false);
    }
  };

  // Global shortcut to focus search input instantly (/ or Ctrl+F / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f'))) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to highlight matching search term in product names
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase() ? (
              <mark key={i} className="bg-amber-300 text-stone-950 font-bold px-1 py-0.5 rounded-sm shadow-2xs">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch {
      return text;
    }
  };

  // Edit / Add Modal
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Chexollar',
    brand: '',
    barcode: '',
    purchasePrice: 0,
    wholesalePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStockAlert: 5
  });

  const filterCategories = useMemo(
    () => ['all', ...Array.from(new Set([...availableCategories, ...products.map((p) => p.category)]))],
    [availableCategories, products]
  );

  // Calculations
  const totalStockQuantity = products.reduce((sum, p) => sum + (Number(p?.stock) || 0), 0);
  const totalCapitalAtCost = products.reduce((sum, p) => sum + ((Number(p?.purchasePrice) || 0) * (Number(p?.stock) || 0)), 0);
  const totalExpectedRetail = products.reduce((sum, p) => sum + ((Number(p?.sellingPrice) || 0) * (Number(p?.stock) || 0)), 0);
  const criticalStockCount = products.filter((p) => (Number(p?.stock) || 0) <= 3 && (Number(p?.stock) || 0) > 0).length;
  const lowStockCount = products.filter((p) => (Number(p?.stock) || 0) <= (Number(p?.minStockAlert) || 5) && (Number(p?.stock) || 0) > 0).length;
  const zeroStockCount = products.filter((p) => (Number(p?.stock) || 0) <= 0).length;

  // Filter products
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      if (!p) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      const stockNum = Number(p.stock) || 0;
      const minAlert = Number(p.minStockAlert) || 5;
      if (stockStatusFilter === 'critical3' && (stockNum > 3 || stockNum <= 0)) return false;
      if (stockStatusFilter === 'low' && (stockNum > minAlert || stockNum <= 0)) return false;
      if (stockStatusFilter === 'zero' && stockNum > 0) return false;

      return true;
    });
    return searchProducts(filtered, searchQuery);
  }, [products, selectedCategory, stockStatusFilter, searchQuery]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setFormData({
      name: '',
      category: 'Chexollar',
      brand: 'Universal',
      barcode: `${Math.floor(100000 + Math.random() * 900000)}`,
      purchasePrice: 40000,
      wholesalePrice: 65000,
      sellingPrice: 80000,
      stock: 10,
      minStockAlert: 5
    });
  };

  const handleOpenEdit = (prod: Product) => {
    setModalMode('edit');
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      category: prod.category,
      brand: prod.brand,
      barcode: prod.barcode,
      purchasePrice: prod.purchasePrice,
      wholesalePrice: prod.wholesalePrice || Math.round(prod.sellingPrice * 0.8),
      sellingPrice: prod.sellingPrice,
      stock: prod.stock,
      minStockAlert: prod.minStockAlert
    });
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (modalMode === 'create') {
      const newP: Product = {
        id: `prod-${Date.now()}`,
        name: formData.name.trim(),
        category: formData.category,
        brand: formData.brand.trim() || 'Universal',
        barcode: formData.barcode.trim() || `${Math.floor(100000 + Math.random() * 900000)}`,
        purchasePrice: Number(formData.purchasePrice),
        wholesalePrice: Number(formData.wholesalePrice) || Math.round(Number(formData.sellingPrice) * 0.8),
        sellingPrice: Number(formData.sellingPrice),
        stock: Number(formData.stock),
        minStockAlert: Number(formData.minStockAlert)
      };
      onAddProduct(newP);
    } else if (modalMode === 'edit' && editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: formData.name.trim(),
        category: formData.category,
        brand: formData.brand.trim(),
        barcode: formData.barcode.trim(),
        purchasePrice: Number(formData.purchasePrice),
        wholesalePrice: Number(formData.wholesalePrice) || Math.round(Number(formData.sellingPrice) * 0.8),
        sellingPrice: Number(formData.sellingPrice),
        stock: Number(formData.stock),
        minStockAlert: Number(formData.minStockAlert)
      });
    }

    setModalMode(null);
  };

  const handleExportCSV = () => {
    const headers = [
      'Tovar Nomi',
      'Kategoriya',
      'Brend',
      'Shtrix-kod',
      'Qoldiq (dona)',
      isAdminUnlocked ? 'Tan narxi (so\'m)' : 'Tan narxi',
      'Optom narxi (so\'m)',
      'Chakana narxi (so\'m)',
      isAdminUnlocked ? 'Umumiy tan narxi qiymati' : 'Umumiy tan qiymati',
      'Umumiy kutilayotgan sotuv summasi'
    ];

    const rows = products.map((p) => [
      p.name,
      p.category,
      p.brand,
      p.barcode,
      p.stock.toString(),
      isAdminUnlocked ? p.purchasePrice.toString() : '*** (Maxfiy)',
      (p.wholesalePrice || Math.round(p.sellingPrice * 0.8)).toString(),
      p.sellingPrice.toString(),
      isAdminUnlocked ? (p.purchasePrice * p.stock).toString() : '*** (Maxfiy)',
      (p.sellingPrice * p.stock).toString()
    ]);

    downloadCSV(
      `Paxtaobod_Beeline_Ombor_Qoldigi_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers, ...rows]
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Warehouse Valuation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Ombor Kapitali (Tan narxida)</span>
            {!isAdminUnlocked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
          </div>
          {isAdminUnlocked ? (
            <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
              {formatMoney(totalCapitalAtCost)}
            </div>
          ) : (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xl font-black text-stone-400 font-mono tracking-widest">••••••••</span>
              <button
                type="button"
                onClick={onRequireUnlock}
                className="px-2 py-1 bg-amber-400/20 hover:bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                title="PIN-kod kiritib tan narxlarni ko'rish"
              >
                <KeyRound className="w-3 h-3 text-amber-600" />
                <span>Ochish (PIN)</span>
              </button>
            </div>
          )}
          <div className="text-xs text-stone-500 mt-1">
            {isAdminUnlocked ? `Ombordagi ${totalStockQuantity} dona tovarning asl qiymati` : "Faqat do'kon rahbari uchun himoyalangan"}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase">
            Kutilayotgan Umumiy Tushum
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-600 mt-2">
            {formatMoney(totalExpectedRetail)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Barcha tovarlar sotilgandagi jami summa
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-5 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Yetarli Qoldiqdagi Tovarlar</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 mt-2">
            {products.length - lowStockCount} xil
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Sotuvga to'liq tayyor aksessuarlar
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStockStatusFilter(stockStatusFilter === 'critical3' ? 'all' : 'critical3')}
          className={`text-left bg-white rounded-2xl border p-5 shadow-xs transition-all cursor-pointer ${
            criticalStockCount > 0 
              ? 'border-amber-300 ring-2 ring-amber-300/60 hover:bg-amber-50/40' 
              : 'border-stone-200 hover:border-amber-300'
          }`}
        >
          <div className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase flex items-center justify-between">
            <span>Tanqidiy Qoldiq (≤3 dona)</span>
            <AlertTriangle className={`w-4 h-4 ${criticalStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-stone-400'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-lg sm:text-2xl font-black ${criticalStockCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
              {criticalStockCount} ta tovar
            </span>
            {criticalStockCount > 0 && (
              <span className="text-[10px] font-black text-amber-950 bg-amber-200 px-2 py-0.5 rounded-md border border-amber-300">
                Kam qoldi!
              </span>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
            <span>{criticalStockCount > 0 ? "Filtrlash uchun bosing" : "Omborda barcha tovarlar yetarli"}</span>
            {lowStockCount > criticalStockCount && (
              <span className="text-[10px] text-stone-400 font-medium">Umumiy kam: {lowStockCount}</span>
            )}
          </div>
        </button>
      </div>

      {/* Dedicated Warehouse Search & Filter Panel */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Top: Large Dedicated Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Mahsulot nomi, brend yoki shtrix-kod bo'yicha qidirish... (Masalan: iPhone 15, Remax, Shisha, Zaryadka...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-24 py-2.5 bg-stone-50 hover:bg-stone-50/80 focus:bg-white border-2 border-stone-200 focus:border-amber-400 rounded-xl text-sm font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                  title="Qidiruvni tozalash"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-300 rounded shadow-2xs">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Action Buttons: Manage Categories & Add Product */}
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 [&>button]:px-3 [&>button]:py-2 sm:[&>button]:px-3.5 sm:[&>button]:py-2.5">
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-stone-200"
              title="Kataloglarni boshqarish va yangi katalog qo'shish"
            >
              <Tag className="w-4 h-4 text-amber-600" />
              <span>🏷️ Kataloglar ({availableCategories.length})</span>
            </button>

            {onOpenPdfReports && (
              <button
                type="button"
                onClick={() => onOpenPdfReports('out_of_stock')}
                className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Tugagan va kam qolgan tovarlar uchun ta'minotchiga zakaz varaqasini PDF qilish"
              >
                <FileText className="w-4 h-4" />
                <span>📋 Zakaz PDF</span>
              </button>
            )}

            {onOpenPdfReports && (
              <button
                type="button"
                onClick={() => onOpenPdfReports('stock_inventory')}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Ombor tovarlari va kapital hisobotini rangli PDF qilish"
              >
                <FileText className="w-4 h-4" />
                <span>📄 Ombor PDF</span>
              </button>
            )}

            {onOpenExcelImport && (
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Excel (.xlsx, .csv) fayl orqali tovarlarni ommaviy yuklash"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📥 Excel Kirim</span>
              </button>
            )}

            {onNavigateToAiAnalyst && (
              <button
                type="button"
                onClick={onNavigateToAiAnalyst}
                className="px-3.5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 text-xs sm:text-sm font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Sun'iy intellekt xarid maslahati va Telegramga kam tovarlarni jo'natish"
              >
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>🧠 AI Maslahatchi & Telegram</span>
              </button>
            )}

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs sm:text-sm font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yangi Tovar Kiritish</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter & Stats Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-stone-100">
          {/* Quick Category & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
            >
              {filterCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'Barcha kataloglar' : cat}
                </option>
              ))}
            </select>

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  stockStatusFilter === 'all'
                    ? 'bg-white text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Barchasi ({products.length})
              </button>
              <button
                onClick={() => setStockStatusFilter('critical3')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                  stockStatusFilter === 'critical3'
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-amber-700'
                }`}
                title="Qoldig'i 3 ta yoki undan kam bo'lgan tovarlar"
              >
                <span>⚠️ ≤3 dona</span>
                <span className="text-[10px] bg-amber-200 text-stone-900 px-1 rounded-full font-black">
                  {criticalStockCount}
                </span>
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  stockStatusFilter === 'low'
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-amber-700'
                }`}
              >
                Kam qolgan ({lowStockCount})
              </button>
              <button
                onClick={() => setStockStatusFilter('zero')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  stockStatusFilter === 'zero'
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'text-stone-600 hover:text-red-700'
                }`}
              >
                Tugagan / 0 ({zeroStockCount})
              </button>
            </div>

            {/* If zero stock products exist: quick cleanup */}
            {zeroStockCount > 0 && onClearZeroStockProducts && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Qoldig'i 0 bo'lgan barcha ${zeroStockCount} ta eski tovarlarni ro'yxatdan o'chirmoqchimisiz?`)) {
                    onClearZeroStockProducts();
                  }
                }}
                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1 border border-red-200 transition-colors cursor-pointer"
                title="Qoldig'i 0 bo'lgan eski tovarlarni tozalash"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tugaganlarni tozalash</span>
              </button>
            )}
          </div>

          {/* Search Result Counter & Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-500">
              Topildi: <strong className="text-stone-900">{filteredProducts.length}</strong> / {products.length} ta
            </span>

            {/* Clear active filters button */}
            {(searchQuery || selectedCategory !== 'all' || stockStatusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStockStatusFilter('all');
                }}
                className="px-2 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Tozalash
              </button>
            )}

            {/* Export & Import */}
            {onOpenExcelImport && (
              <button
                onClick={onOpenExcelImport}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Excel / CSV orqali tovarlarni yuklash"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {/* Quick Search Suggestion Tags */}
        <div className="flex items-center gap-1.5 text-xs text-stone-400 overflow-x-auto pb-1 pt-0.5">
          <span className="font-semibold text-stone-500 shrink-0">Ommabop qidiruv:</span>
          {['iPhone', 'Samsung', 'Remax', 'Hoco', 'Chexol', 'Shisha', 'Zaryadka', 'Kabel'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSearchQuery(tag);
                searchInputRef.current?.focus();
              }}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                searchQuery.toLowerCase() === tag.toLowerCase()
                  ? 'bg-amber-400 text-stone-950 shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card List (Telefonda Qulay Kartalar) */}
      <div className="md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
            Aksessuarlar topilmadi
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isZero = p.stock <= 0;
            const isCritical = p.stock > 0 && p.stock <= 3;
            const isLow = p.stock > 3 && p.stock <= 7;
            const optomPrice = p.wholesalePrice || Math.round(p.sellingPrice * 0.8);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-xs space-y-2.5"
              >
                {/* Header: Title & Stock */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-black text-sm text-stone-900 flex items-center gap-1.5 leading-tight">
                      {isCritical && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span>{p.name}</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                        {p.category}
                      </span>
                      <span>•</span>
                      <span>{p.brand}</span>
                      {p.barcode && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-stone-500">#{p.barcode}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stock Badge */}
                  <div className="shrink-0">
                    {isZero ? (
                      <span className="px-2 py-1 rounded-full font-black text-xs bg-red-100 text-red-700">
                        0 dona
                      </span>
                    ) : isCritical ? (
                      <span className="px-2 py-1 rounded-full font-black text-xs bg-amber-400 text-stone-950 shadow-xs">
                        ⚠️ {p.stock} dona
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-1 rounded-full font-black text-xs bg-amber-100 text-amber-800">
                        {p.stock} dona
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full font-black text-xs bg-emerald-100 text-emerald-800">
                        {p.stock} dona
                      </span>
                    )}
                  </div>
                </div>

                {/* Price Grid */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
                  <div className="bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-center">
                    <div className="text-[9px] font-bold text-amber-800 uppercase tracking-tight">Chakana</div>
                    <div className="font-black text-stone-950 mt-0.5 text-xs truncate">
                      {formatMoney(p.sellingPrice)}
                    </div>
                  </div>
                  <div className="bg-blue-50/70 border border-blue-200/60 p-2 rounded-xl text-center">
                    <div className="text-[9px] font-bold text-blue-800 uppercase tracking-tight">Optom</div>
                    <div className="font-black text-blue-800 mt-0.5 text-xs truncate">
                      {formatMoney(optomPrice)}
                    </div>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 p-2 rounded-xl text-center">
                    <div className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Tan Narx</div>
                    <div className="font-black text-stone-700 mt-0.5 text-xs truncate">
                      {isAdminUnlocked ? (
                        formatMoney(p.purchasePrice)
                      ) : (
                        <span 
                          onClick={onRequireUnlock}
                          className="text-stone-400 cursor-pointer font-bold"
                        >
                          ••••••
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions Row */}
                <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                  <span className="text-[11px] text-stone-400">
                    Jami tan: {isAdminUnlocked ? formatMoney(p.stock * p.purchasePrice) : '••••••'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onQuickKirimForProduct(p)}
                      className="px-3.5 py-2.5 sm:px-2.5 sm:py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>+ Kirim</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-2.5 sm:p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${p.name}" tovarini o'chirmoqchimisiz?`)) {
                          onDeleteProduct(p.id);
                        }
                      }}
                      className="p-2.5 sm:p-1.5 bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stock Table (Desktop Screens) */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Tovar Nomi &amp; Kategoriya</th>
                <th className="py-3 px-4 text-center">Shtrix-kod</th>
                <th className="py-3 px-4 text-right">
                  {isAdminUnlocked ? (
                    <span>Tan Narxi</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequireUnlock}
                      className="inline-flex items-center gap-1 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer font-bold"
                      title="Tan narxlarni ochish uchun bosing"
                    >
                      <span>Tan Narx</span>
                      <Lock className="w-3 h-3 text-amber-500" />
                    </button>
                  )}
                </th>
                <th className="py-3 px-4 text-right text-blue-800 bg-blue-50/60">Optom Narx</th>
                <th className="py-3 px-4 text-right text-stone-900 bg-amber-50/40">Chakana Narx</th>
                <th className="py-3 px-4 text-center">Ombor Qoldig'i</th>
                <th className="py-3 px-4 text-right">
                  {isAdminUnlocked ? (
                    <span>Jami Tan Qiymati</span>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequireUnlock}
                      className="inline-flex items-center gap-1 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer font-bold"
                      title="Umumiy tan qiymatini ochish uchun bosing"
                    >
                      <span>Tan Qiymat</span>
                      <Lock className="w-3 h-3 text-amber-500" />
                    </button>
                  )}
                </th>
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Search className="w-8 h-8 text-stone-300" />
                      <div className="font-bold text-sm text-stone-700">
                        {searchQuery ? `«${searchQuery}» so'rovi bo'yicha tovar topilmadi` : 'Mos tovarlar topilmadi'}
                      </div>
                      <div className="text-xs text-stone-400 max-w-sm">
                        Qidiruv so'zini tekshiring yoki barcha ombordagi mahsulotlarni ko'rish uchun tozalang.
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('all');
                            setStockStatusFilter('all');
                          }}
                          className="mt-2 px-3 py-1.5 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 cursor-pointer"
                        >
                          Barcha tovarlarni ko'rsatish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isCritical = p.stock <= 3 && p.stock > 0;
                  const isLow = p.stock <= p.minStockAlert && !isCritical;
                  const isZero = p.stock <= 0;
                  const itemTotalCost = p.purchasePrice * p.stock;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isCritical
                          ? 'bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-100/50'
                          : isZero
                          ? 'bg-red-50/30 hover:bg-red-50/60'
                          : 'hover:bg-stone-50/70'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          {isCritical && (
                            <span
                              title="Tanqidiy qoldiq: 3 dona yoki undan kam qolgan!"
                              className="inline-flex items-center text-amber-600 shrink-0"
                            >
                              <AlertTriangle className="w-4 h-4 animate-pulse" />
                            </span>
                          )}
                          <span>{highlightMatch(p.name, searchQuery)}</span>
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-1">
                          <span className="font-semibold text-stone-600">{p.category}</span>
                          <span>•</span>
                          <span>{highlightMatch(p.brand, searchQuery)}</span>
                          {isCritical && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 font-bold px-1.5 py-0.2 rounded">
                              Tanqidiy zaxira (≤3)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-[11px] text-stone-500 whitespace-nowrap">
                        {highlightMatch(p.barcode, searchQuery)}
                      </td>

                      <td className="py-3 px-4 text-right text-stone-600 font-medium whitespace-nowrap">
                        {isAdminUnlocked ? (
                          formatMoney(p.purchasePrice)
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

                      <td className="py-3 px-4 text-right font-bold text-blue-700 bg-blue-50/30 whitespace-nowrap">
                        {formatMoney(p.wholesalePrice || Math.round(p.sellingPrice * 0.8))}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-stone-900 bg-amber-50/20 whitespace-nowrap">
                        {formatMoney(p.sellingPrice)}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isZero ? (
                          <span className="inline-block px-2.5 py-1 rounded-full font-black text-xs bg-red-100 text-red-700">
                            Tugagan (0 dona)
                          </span>
                        ) : isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs bg-amber-400 text-stone-950 ring-2 ring-amber-400/40 shadow-xs">
                            <AlertTriangle className="w-3 h-3 text-amber-950 shrink-0" />
                            <span>{p.stock} dona (Tanqidiy!)</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-block px-2.5 py-1 rounded-full font-black text-xs bg-amber-100 text-amber-800">
                            {p.stock} dona (Kam)
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full font-black text-xs bg-emerald-50 text-emerald-800">
                            {p.stock} dona
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-stone-900 whitespace-nowrap">
                        {isAdminUnlocked ? (
                          formatMoney(itemTotalCost)
                        ) : (
                          <span
                            onClick={onRequireUnlock}
                            className="text-stone-400 font-mono tracking-wider cursor-pointer hover:text-amber-600 transition-colors"
                            title="Umumiy tan qiymatini ko'rish uchun bosing"
                          >
                            ••••••
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onQuickKirimForProduct(p)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            title="Tezkor kirim qilish"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${p.name}" tovarini o'chirmoqchimisiz?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Modal for Add/Edit Product */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalMode === 'create' ? 'Yangi Aksessuar Qo\'shish' : 'Tovarni Tahrirlash'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Tovar to'liq nomi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Remax 20W Zaryadnik"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-stone-700">Kategoriya / Katalog *</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingCat(!isInlineAddingCat)}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Yangi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCategoryManagerOpen(true)}
                        className="text-[10px] text-stone-500 hover:text-stone-800 font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Kataloglarni boshqarish"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Kataloglar</span>
                      </button>
                    </div>
                  </div>

                  {isInlineAddingCat ? (
                    <div className="space-y-1 mb-1.5 p-1.5 bg-stone-100 rounded-lg border border-amber-300">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Yangi katalog..."
                          value={inlineCatName}
                          onChange={(e) => setInlineCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddInlineCategory();
                            }
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-stone-300 rounded text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddInlineCategory}
                          className="px-2.5 py-1 bg-amber-400 text-stone-950 font-bold text-xs rounded cursor-pointer"
                        >
                          Qo'shish
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsInlineAddingCat(false);
                            setInlineCatName('');
                          }}
                          className="px-1.5 py-1 bg-stone-200 text-stone-700 text-xs rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsInlineAddingCat(true);
                        } else if (e.target.value === '__manage__') {
                          setIsCategoryManagerOpen(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 font-semibold text-stone-900"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option disabled>──────────────</option>
                      <option value="__add_new__">+ Yangi katalog yaratish...</option>
                      <option value="__manage__">⚙️ Kataloglarni boshqarish...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Brend
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Tan narxi (kelish) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-blue-700 mb-1">
                    Optom (ulgurji) narx
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.wholesalePrice || ''}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Chakana sotish narxi *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Ombordagi qoldiq (dona) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Kam qolish chegarasi
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Shtrix-kod (Ixtiyoriy)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Masalan: 478012"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, barcode: `${Math.floor(100000 + Math.random() * 900000)}` })}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-[11px] cursor-pointer"
                  >
                    Yangi kod
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <CategoryManagerModal
          categories={availableCategories}
          products={products}
          onAddCategory={(cat) => (onAddCategory ? onAddCategory(cat) : false)}
          onEditCategory={(oldN, newN) => (onEditCategory ? onEditCategory(oldN, newN) : false)}
          onDeleteCategory={(cat) => (onDeleteCategory ? onDeleteCategory(cat) : false)}
          onClose={() => setIsCategoryManagerOpen(false)}
          onSelectCategory={(cat) => {
            setFormData((prev) => ({ ...prev, category: cat }));
            setSelectedCategory(cat);
          }}
        />
      )}
    </div>
  );
};
