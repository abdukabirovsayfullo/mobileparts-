import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Product, StockMovement, DebtRecord, SupplierDebtRecord, StoreSettings, OrderItem } from '../types';
import { formatMoney } from '../utils/formatters';
import { 
  createOrderPdf, 
  createSalesPdf, 
  createStockInventoryPdf, 
  createLowStockPdf,
  createDebtsPdf, 
  triggerPdfDownload, 
  openPdfInNewTab, 
  printHtmlElement 
} from '../utils/pdfGenerator';
import { OrderBuilderPanel } from './OrderBuilderPanel';
import { 
  FileText, 
  Download, 
  Printer, 
  X, 
  AlertTriangle, 
  Calendar, 
  Package, 
  Truck, 
  BookOpen, 
  Copy, 
  Check, 
  Sparkles,
  Eye,
  EyeOff,
  Filter,
  Search,
  Edit3,
  CheckCircle2,
  Share2,
  ExternalLink
} from 'lucide-react';

export type PdfReportType = 
  | 'out_of_stock'       // Tugagan va kam qolgan tovarlar (Zakaz varaqasi)
  | 'low_stock'          // Faqat kam qolgan tovarlar ro'yxati (narxsiz)
  | 'daily_sales'        // Kunlik / Oraliq savdo va kassa hisoboti
  | 'stock_inventory'    // Ombor inventarizatsiyasi va qoldiqlar
  | 'customer_debts'     // Nasiyalar va mijozlar qarzi
  | 'supplier_debts';    // Ta'minotchilar oldidagi qarzlar

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportType?: PdfReportType;
  products: Product[];
  movements: StockMovement[];
  debts: DebtRecord[];
  supplierDebts: SupplierDebtRecord[];
  storeInfo: StoreSettings;
  isAdminUnlocked?: boolean;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  initialReportType = 'out_of_stock',
  products,
  movements,
  debts,
  supplierDebts,
  storeInfo,
  isAdminUnlocked = true
}) => {
  const [reportType, setReportType] = useState<PdfReportType>(initialReportType);

  // Date Range state
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Supplier Target
  const [supplierTarget, setSupplierTarget] = useState<string>('Abu Saxiy & Malika Dilerlari');

  // Sub-tab for Zakaz: 'preview' (A4 PDF Document) or 'builder' (Interactive Editor)
  const [zakazViewMode, setZakazViewMode] = useState<'preview' | 'builder'>('preview');

  // Price visibility for Zakaz (Supplier Order sheet)
  // Default is FALSE because the sheet is handed/sent to the supplier!
  const [showPricesInOrder, setShowPricesInOrder] = useState<boolean>(false);

  // Interactive Order Items state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Filtering for PDF views
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'zero' | 'low' | 'adequate'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lowIncludeZero, setLowIncludeZero] = useState<boolean>(true);

  // Toggles for PDF layout
  const [includeProfitInPdf, setIncludeProfitInPdf] = useState<boolean>(isAdminUnlocked);
  const [copiedTelegramText, setCopiedTelegramText] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Initialize order items from products
  const initOrderItemsFromProducts = () => {
    const lowStockList = products.filter((p) => p.stock <= (p.minStockAlert || 5));
    const items: OrderItem[] = lowStockList.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.name,
      category: p.category || 'Boshqa',
      quantity: Math.max(10, (p.minStockAlert || 5) * 3),
      unit: 'dona',
      purchasePrice: p.purchasePrice || 0,
      currentStock: p.stock,
      selected: true,
      notes: p.stock === 0 ? 'Shoshilinch (0 qolgan)' : 'Kam qoldi',
      barcode: p.barcode,
      isCustom: false
    }));
    setOrderItems(items);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialReportType) {
        setReportType(initialReportType);
      }
      if (orderItems.length === 0) {
        initOrderItemsFromProducts();
      }
    }
  }, [isOpen, initialReportType]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Handle date preset change
  const handleSelectDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayISO);
      setEndDate(todayISO);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yISO = y.toISOString().slice(0, 10);
      setStartDate(yISO);
      setEndDate(yISO);
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 6);
      setStartDate(w.toISOString().slice(0, 10));
      setEndDate(todayISO);
    } else if (preset === 'month') {
      const m = new Date();
      m.setDate(1);
      setStartDate(m.toISOString().slice(0, 10));
      setEndDate(todayISO);
    }
  };

  // Days count in range
  const daysInRange = useMemo(() => {
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [startDate, endDate]);

  // 1. Zakaz Items (Ordered & Selected for PDF)
  const printableOrderItems = useMemo(() => {
    return orderItems.filter((item) => {
      if (!item.selected) return false;
      const matchesCat = selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.model.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesStatus = 
        stockStatusFilter === 'all' ? true :
        stockStatusFilter === 'zero' ? item.currentStock === 0 :
        stockStatusFilter === 'low' ? item.currentStock > 0 && item.currentStock <= 5 : true;

      return matchesCat && matchesSearch && matchesStatus;
    });
  }, [orderItems, selectedCategoryFilter, searchQuery, stockStatusFilter]);

  // Kam qolgan tovarlar: qoldiq minimumdan oshmagan (xohlasa tugaganlar ham), eng kami birinchi
  const lowStockProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter((p) => p.stock <= (p.minStockAlert || 5) && (lowIncludeZero || p.stock > 0))
      .filter((p) => selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [products, searchQuery, selectedCategoryFilter, lowIncludeZero]);

  const totalEstimatedOrderCost = useMemo(() => {
    return printableOrderItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);
  }, [printableOrderItems]);

  const totalOrderUnits = useMemo(() => {
    return printableOrderItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [printableOrderItems]);

  // 2. Sales Movements for the Date Range
  const filteredSalesMovements = useMemo(() => {
    return movements.filter((m) => {
      if (m.type !== 'chiqim') return false;
      const mDate = m.timestamp.slice(0, 10);
      const inDateRange = mDate >= startDate && mDate <= endDate;
      if (!inDateRange) return false;

      const matchesCat = selectedCategoryFilter === 'all' || m.category === selectedCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        m.productName.toLowerCase().includes(q) || 
        (m.counterparty && m.counterparty.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [movements, startDate, endDate, selectedCategoryFilter, searchQuery]);

  const salesStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalQuantity = 0;
    let cash = 0;
    let clickPayme = 0;
    let uzum = 0;
    let debt = 0;

    filteredSalesMovements.forEach((m) => {
      totalRevenue += m.totalRevenue || 0;
      totalCost += m.totalCost || 0;
      totalProfit += m.profit || 0;
      totalQuantity += m.quantity || 0;

      if (m.paymentMethod === 'naqd') cash += m.totalRevenue;
      else if (m.paymentMethod === 'click_payme') clickPayme += m.totalRevenue;
      else if (m.paymentMethod === 'uzum') uzum += m.totalRevenue;
      else if (m.paymentMethod === 'nasiya') debt += m.totalRevenue;
    });

    return { totalRevenue, totalCost, totalProfit, totalQuantity, cash, clickPayme, uzum, debt };
  }, [filteredSalesMovements]);

  // 3. Stock Inventory Data & Filtered List
  const filteredStockProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.barcode.includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q));
      
      const matchesStatus = 
        stockStatusFilter === 'all' ? true :
        stockStatusFilter === 'zero' ? p.stock === 0 :
        stockStatusFilter === 'low' ? p.stock > 0 && p.stock <= (p.minStockAlert || 5) :
        p.stock > (p.minStockAlert || 5);

      return matchesCat && matchesSearch && matchesStatus;
    });
  }, [products, selectedCategoryFilter, searchQuery, stockStatusFilter]);

  const inventoryStats = useMemo(() => {
    let totalItemsCount = filteredStockProducts.length;
    let totalUnits = 0;
    let totalPurchaseValue = 0;
    let totalRetailValue = 0;
    let totalWholesaleValue = 0;

    const categoryMap: Record<string, { count: number; units: number; purchaseVal: number; retailVal: number }> = {};

    filteredStockProducts.forEach((p) => {
      const stock = Number(p.stock) || 0;
      const purchase = Number(p.purchasePrice) || 0;
      const selling = Number(p.sellingPrice) || 0;
      const wholesale = Number(p.wholesalePrice) || Math.round(selling * 0.85);

      totalUnits += stock;
      totalPurchaseValue += stock * purchase;
      totalRetailValue += stock * selling;
      totalWholesaleValue += stock * wholesale;

      const cat = p.category || 'Boshqa';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { count: 0, units: 0, purchaseVal: 0, retailVal: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].units += stock;
      categoryMap[cat].purchaseVal += stock * purchase;
      categoryMap[cat].retailVal += stock * selling;
    });

    return {
      totalItemsCount,
      totalUnits,
      totalPurchaseValue,
      totalRetailValue,
      totalWholesaleValue,
      categoryMap
    };
  }, [filteredStockProducts]);

  // 4. Debts
  const activeCustomerDebts = useMemo(() => {
    return debts.filter((d) => d.status !== 'yopildi');
  }, [debts]);

  const totalCustomerDebtSum = useMemo(() => {
    return activeCustomerDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  }, [activeCustomerDebts]);

  // 5. Supplier Debts
  const activeSupplierDebts = useMemo(() => {
    return supplierDebts.filter((d) => d.status !== 'yopildi');
  }, [supplierDebts]);

  const totalSupplierDebtSum = useMemo(() => {
    return activeSupplierDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  }, [activeSupplierDebts]);

  // Handlers for Order Builder
  const handleUpdateOrderItem = (updated: OrderItem) => {
    setOrderItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleDeleteOrderItem = (id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCustomOrderItem = (newItem: OrderItem) => {
    setOrderItems((prev) => [newItem, ...prev]);
  };

  const handleAddFromWarehouseProduct = (p: Product, qty: number = 20) => {
    const newItem: OrderItem = {
      id: p.id,
      name: p.name,
      model: p.name,
      category: p.category || 'Boshqa',
      quantity: qty,
      unit: 'dona',
      purchasePrice: p.purchasePrice || 0,
      currentStock: p.stock,
      selected: true,
      notes: p.stock === 0 ? 'Tugagan' : '',
      barcode: p.barcode,
      isCustom: false
    };
    setOrderItems((prev) => {
      if (prev.some((i) => i.id === p.id)) return prev;
      return [newItem, ...prev];
    });
  };

  const handleBatchAdjustQuantity = (delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.selected ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    );
  };

  const handleSetMinQuantity = (minQty: number) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.selected ? { ...item, quantity: Math.max(minQty, item.quantity) } : item))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setOrderItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleSelectZeroStockOnly = () => {
    setOrderItems((prev) =>
      prev.map((item) => ({ ...item, selected: item.currentStock === 0 }))
    );
  };

  // Telegram order text generator (Strictly no prices by default!)
  const handleCopyTelegramOrder = () => {
    const lines = [
      `📦 BUYURTMA (ZAKAZ) VARAQASI`,
      `🏢 Do'kon: ${storeInfo.name}`,
      `📞 Tel: ${storeInfo.phone}`,
      `🚚 Ta'minotchi: ${supplierTarget}`,
      `📅 Sana: ${new Date().toLocaleDateString('uz-UZ')}`,
      `-----------------------------`,
      ...printableOrderItems.map((item, i) => {
        const note = item.notes ? ` [${item.notes}]` : '';
        return `${i + 1}. ${item.model} — ${item.quantity} ${item.unit} (${item.category})${note}`;
      }),
      `-----------------------------`,
      `Jami: ${printableOrderItems.length} xil mahsulot (${totalOrderUnits} dona)`,
      `Iltimos, yetkazib berish vaqtini va partiyani tasdiqlang.`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedTelegramText(true);
    setTimeout(() => setCopiedTelegramText(false), 2500);
  };

  // Generate vector PDF document using jsPDF & autotable
  const generateCurrentPdfDoc = () => {
    if (reportType === 'low_stock') {
      return createLowStockPdf({ storeInfo, products: lowStockProducts, dateStr: new Date().toLocaleDateString('uz-UZ') });
    }
    if (reportType === 'out_of_stock') {
      return createOrderPdf({
        storeInfo,
        supplierTarget,
        orderItems: printableOrderItems,
        dateStr: new Date().toLocaleDateString('uz-UZ')
      });
    } else if (reportType === 'daily_sales') {
      return createSalesPdf({
        storeInfo,
        startDate,
        endDate,
        transactions: filteredSalesMovements,
        totalRevenue: salesStats.totalRevenue,
        cashRevenue: salesStats.cash,
        cardRevenue: salesStats.clickPayme + salesStats.uzum,
        debtRevenue: salesStats.debt,
        totalProfit: salesStats.totalProfit,
        includeProfit: includeProfitInPdf
      });
    } else if (reportType === 'stock_inventory') {
      return createStockInventoryPdf({
        storeInfo,
        products: filteredStockProducts,
        categoryFilter: selectedCategoryFilter
      });
    } else if (reportType === 'customer_debts') {
      return createDebtsPdf({
        storeInfo,
        debts: activeCustomerDebts,
        type: 'customer',
        totalDebtSum: totalCustomerDebtSum
      });
    } else {
      return createDebtsPdf({
        storeInfo,
        debts: activeSupplierDebts,
        type: 'supplier',
        totalDebtSum: totalSupplierDebtSum
      });
    }
  };

  // Trigger vector PDF Download
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setDownloadSuccessMessage(null);

    try {
      const dateTag = startDate === endDate ? startDate : `${startDate}_${endDate}`;
      let fileName = 'Hisobot';

      if (reportType === 'low_stock') {
        fileName = `Kam_Qolgan_Tovarlar_${dateTag}`;
      } else if (reportType === 'out_of_stock') {
        fileName = `Zakaz_Varaqasi_${supplierTarget.replace(/\s+/g, '_').slice(0, 15)}_${dateTag}`;
      } else if (reportType === 'daily_sales') {
        fileName = `Savdo_Kassa_Hisoboti_${dateTag}`;
      } else if (reportType === 'stock_inventory') {
        fileName = `Ombor_Inventarizatsiya_${dateTag}`;
      } else if (reportType === 'customer_debts') {
        fileName = `Mijozlar_Qarzi_${dateTag}`;
      } else if (reportType === 'supplier_debts') {
        fileName = `Taminotchi_Qarzlari_${dateTag}`;
      }

      const doc = generateCurrentPdfDoc();
      const success = triggerPdfDownload(doc, fileName);

      if (success) {
        setDownloadSuccessMessage("✅ PDF fayli qurilmangizga muvaffaqiyatli yuklandi!");
        setTimeout(() => setDownloadSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      printHtmlElement('printable-pdf-document');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Open PDF in a new tab for direct browser PDF viewer controls
  const handleOpenInNewTab = () => {
    try {
      const doc = generateCurrentPdfDoc();
      openPdfInNewTab(doc);
    } catch (err) {
      console.error('Open tab error:', err);
      handlePrintReport();
    }
  };

  // Native & Iframe-isolated Print
  const handlePrintReport = async () => {
    if (reportType === 'out_of_stock' && zakazViewMode === 'builder') {
      setZakazViewMode('preview');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    printHtmlElement('printable-pdf-document');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in print:p-0 print:bg-white">
      <div 
        id="pdf-report-modal-card"
        className="bg-stone-900 border border-stone-800 rounded-none sm:rounded-3xl w-full max-w-6xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[96vh] flex flex-col shadow-2xl overflow-hidden sm:my-auto print:border-none print:shadow-none print:max-w-none print:max-h-none print:bg-white"
      >
        {/* Header (No-print) */}
        <div className="no-print px-3 sm:px-7 py-2.5 sm:py-4 bg-gradient-to-r from-amber-950/70 via-stone-900 to-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-stone-950 shadow-md">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Rasmiy Rangli PDF & Zakaz Tizimi
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-stone-950">
                  A4 Eksport
                </span>
              </div>
              <p className="hidden sm:block text-xs text-stone-400 mt-0.5">
                Ta'minotchi uchun narxlarsiz zakaz varaqasi, kunlik savdo va ombor hisobotlari
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar (No-print) */}
        <div className="no-print px-3 sm:px-5 py-2 sm:py-2.5 bg-stone-950 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 sm:gap-2.5 shrink-0">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 p-1 bg-stone-900 rounded-xl border border-stone-800 text-xs font-bold w-full sm:w-auto overflow-x-auto sm:overflow-visible">
            <button
              type="button"
              onClick={() => setReportType('out_of_stock')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'out_of_stock'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>🛒 Zakaz Berish (Ta'minotchi uchun)</span>
              {orderItems.filter((i) => i.currentStock === 0).length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">
                  {orderItems.filter((i) => i.currentStock === 0).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setReportType('low_stock')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'low_stock'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>⚠️ Kam qolgan tovarlar PDF</span>
              {lowStockProducts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">{lowStockProducts.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setReportType('daily_sales')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'daily_sales'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>📊 Savdo & Kassa PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setReportType('stock_inventory')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'stock_inventory'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-sky-400" />
              <span>📦 Ombor Inventarizatsiya PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setReportType('customer_debts')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'customer_debts'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span>💳 Nasiyalar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setReportType('supplier_debts')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                reportType === 'supplier_debts'
                  ? 'bg-amber-400 text-stone-950 shadow font-black'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-rose-400" />
              <span>🚚 Ta'minotchi Qarzlari PDF</span>
            </button>
          </div>

          {/* Sub-view toggle for Zakaz: Preview vs Builder */}
          {reportType === 'out_of_stock' && (
            <div className="flex items-center gap-1 p-1 bg-stone-900 border border-amber-500/30 rounded-xl text-xs font-bold w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setZakazViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  zakazViewMode === 'preview'
                    ? 'bg-amber-400 text-stone-950 font-black'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📄 Zakaz Varaqasi (A4 PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => setZakazViewMode('builder')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  zakazViewMode === 'builder'
                    ? 'bg-amber-400 text-stone-950 font-black'
                    : 'text-amber-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✏️ Zakazni Tahrirlash (Dona, Model)</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Filters & Date Range Controls Bar (No-print) */}
        <div className="no-print px-3 sm:px-5 py-2 sm:py-3 bg-stone-900/90 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs max-h-[28vh] sm:max-h-none overflow-y-auto sm:overflow-visible shrink-0">
          {/* Left: Date Range presets for Sales / Movements */}
          {reportType === 'daily_sales' ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('today')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    datePreset === 'today' ? 'bg-amber-400 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Bugun
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('yesterday')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    datePreset === 'yesterday' ? 'bg-amber-400 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Kecha
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('week')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    datePreset === 'week' ? 'bg-amber-400 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Oxirgi 7 kun
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDatePreset('month')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    datePreset === 'month' ? 'bg-amber-400 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Shu oy
                </button>
              </div>

              {/* Custom Date Pickers */}
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-stone-400 font-medium">Davr:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                />
                <span className="text-stone-500">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                />
                <span className="text-amber-400 font-bold ml-1">({daysInRange} kun)</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-stone-400 font-bold">Hisobot Sanasi:</span>
              <span className="text-white font-bold bg-stone-950 px-2.5 py-1 rounded-lg border border-stone-800">
                {new Date().toLocaleDateString('uz-UZ')}
              </span>
            </div>
          )}

          {/* Right: Category, Status Filters & Price Visibility */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 px-2.5 py-1 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="all">Barcha Toifalar</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {reportType === 'low_stock' && (
              <button
                type="button"
                onClick={() => setLowIncludeZero((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  lowIncludeZero ? 'bg-rose-950/40 border-rose-500/50 text-rose-300' : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
              >
                {lowIncludeZero ? 'Tugaganlar ham bor (0 dona)' : 'Faqat kam qolgan (>0)'}
              </button>
            )}

            {/* Stock status filter for out of stock & stock inventory */}
            {(reportType === 'out_of_stock' || reportType === 'stock_inventory') && (
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="bg-stone-950 border border-stone-800 text-stone-200 font-bold text-xs px-2.5 py-1.5 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="all">Barcha tovarlar</option>
                <option value="zero">Faqat 0 dona qolganlar</option>
                <option value="low">Kam qolganlar (≤5 dona)</option>
                <option value="adequate">Yetarli tovarlar (&gt;5 dona)</option>
              </select>
            )}

            {/* Search Filter */}
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 px-2.5 py-1.5 rounded-xl">
              <Search className="w-3 h-3 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Qidiruv..."
                className="bg-transparent text-white text-xs w-24 sm:w-32 focus:outline-none"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="text-stone-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* PRICE NOTICE FOR ZAKAZ (User explicit requirement: No prices for supplier!) */}
            {reportType === 'out_of_stock' && (
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 flex items-center gap-1.5"
                title="Ta'minotchi uchun narxlar ko'rsatilmaydi. Faqat tovar nomi, modeli va zakaz soni qoladi."
              >
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ta'minotchi Rejimi (Narxlarsiz)</span>
              </div>
            )}

            {/* Profit Visibility toggle for Daily Sales */}
            {reportType === 'daily_sales' && isAdminUnlocked && (
              <button
                type="button"
                onClick={() => setIncludeProfitInPdf(!includeProfitInPdf)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  includeProfitInPdf
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
                title="Foyda raqamlarini hisobotda ko'rsatish yoki berkitish"
              >
                {includeProfitInPdf ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{includeProfitInPdf ? 'Foyda Ochiq' : 'Foyda Berkitilgan'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-6 bg-stone-950/90 print:bg-white print:p-0">
          <div className="max-w-4xl mx-auto print:max-w-none space-y-4">
            {/* If Zakaz & in Builder Mode, show OrderBuilderPanel */}
            {reportType === 'out_of_stock' && zakazViewMode === 'builder' && (
              <div className="no-print">
                <OrderBuilderPanel
                  orderItems={orderItems}
                  allProducts={products}
                  categories={categories}
                  supplierTarget={supplierTarget}
                  onUpdateSupplierTarget={setSupplierTarget}
                  onUpdateOrderItem={handleUpdateOrderItem}
                  onDeleteOrderItem={handleDeleteOrderItem}
                  onAddCustomOrderItem={handleAddCustomOrderItem}
                  onAddFromWarehouseProduct={handleAddFromWarehouseProduct}
                  onBatchAdjustQuantity={handleBatchAdjustQuantity}
                  onSetMinQuantity={handleSetMinQuantity}
                  onToggleSelectAll={handleToggleSelectAll}
                  onSelectZeroStockOnly={handleSelectZeroStockOnly}
                  onResetToOutStock={initOrderItemsFromProducts}
                />
              </div>
            )}

            {/* The printable and canvas-captured A4 container (ALWAYS present in DOM so download/print never fails) */}
            <div
              id="printable-pdf-document"
              ref={reportContainerRef}
              className={`bg-white text-stone-900 p-4 sm:p-10 rounded-2xl shadow-2xl border border-stone-200 min-h-[320px] sm:min-h-[750px] space-y-6 text-sm print:p-0 print:border-none print:shadow-none print:rounded-none ${
                reportType === 'out_of_stock' && zakazViewMode === 'builder' ? 'hidden print:block' : 'block'
              }`}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {/* Official Store Letterhead */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b-2 border-amber-400 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center font-black text-stone-950 text-xl shadow">
                    📱
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-stone-950 uppercase tracking-tight">
                      {storeInfo.name}
                    </h1>
                    <p className="text-xs text-stone-600 font-medium mt-0.5">
                      {storeInfo.address} • Tel: {storeInfo.phone}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right text-xs text-stone-600 space-y-1">
                  <div className="inline-block px-3 py-1 rounded-full font-black text-stone-900 text-xs uppercase tracking-wide bg-amber-100 border border-amber-300">
                    {reportType === 'low_stock' && "⚠️ KAM QOLGAN TOVARLAR RO'YXATI"}
                    {reportType === 'out_of_stock' && '📋 RASMIY BUYURTMA (ZAKAZ) VARAQASI'}
                    {reportType === 'daily_sales' && (startDate === endDate ? '📊 KUNLIK SAVDO VA KASSA HISOBOTI' : '📊 DAVRIY SAVDO VA KASSA HISOBOTI')}
                    {reportType === 'stock_inventory' && '📦 OMBOR INVENTARIZATSIYA HISOBOTI'}
                    {reportType === 'customer_debts' && '💳 NASIYALAR VA MIJOZ QARZLARI'}
                    {reportType === 'supplier_debts' && '🚚 TA\'MINOTCHI QARZLARI HISOBOTI'}
                  </div>
                  <div className="font-medium text-stone-700">
                    {reportType === 'daily_sales' && startDate !== endDate ? (
                      <span>
                        Davr: <strong className="text-stone-950">{startDate}</strong> dan <strong className="text-stone-950">{endDate}</strong> gacha ({daysInRange} kun)
                      </span>
                    ) : (
                      <span>
                        Sana: <strong className="text-stone-950">{new Date().toLocaleDateString('uz-UZ')}</strong> | Vaqt: <strong className="text-stone-950">{new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</strong>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Mas'ul hisobchi: <span className="font-semibold text-stone-800">{storeInfo.accountantName}</span>
                  </div>
                </div>
              </div>

              {/* REPORT TYPE 1: TUGAGAN VA KAM QOLGAN TOVARLAR (ZAKAZ VARAQASI - NARXLARSIZ!) */}
              {reportType === 'out_of_stock' && (
                <div className="space-y-6">
                  {/* Supplier Target & Meta */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-amber-800 font-bold">Ta'minotchi / Yetkazib Beruvchi: </span>
                      <strong className="text-stone-950 text-sm font-black">{supplierTarget}</strong>
                    </div>
                    <div className="text-stone-600 font-semibold">
                      Buyurtma qilinayotgan: <strong className="text-stone-950">{printableOrderItems.length} xil</strong> ({totalOrderUnits} dona)
                    </div>
                  </div>

                  {/* Summary Metric Cards (Pure quantities, STRICTLY NO PRICES!) */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="text-xs font-bold text-rose-700">Tugagan (0 dona qolgan)</div>
                      <div className="text-2xl font-black text-rose-900">
                        {printableOrderItems.filter((i) => i.currentStock === 0).length} xil
                      </div>
                      <div className="text-[11px] text-rose-600 mt-0.5">Shoshilinch partiya</div>
                    </div>

                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-xs font-bold text-amber-800">Buyurtma Turlari</div>
                      <div className="text-2xl font-black text-amber-950">{printableOrderItems.length} xil</div>
                      <div className="text-[11px] text-amber-700 mt-0.5">Aksessuar turlari</div>
                    </div>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-xs font-bold text-emerald-800">Jami Buyurtma Miqdori</div>
                      <div className="text-2xl font-black text-emerald-950">{totalOrderUnits} dona</div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">Umumiy dona soni</div>
                    </div>
                  </div>

                  {/* Order Table: Clean, Clear, with Checkboxes for Supplier to check off */}
                  <div>
                    <div className="text-xs font-black text-stone-900 mb-2 flex items-center justify-between">
                      <span>BUYURTMA QILINADIGAN AKSESSUARLAR VA MODELLAR RO'YXATI:</span>
                      <span className="text-[11px] text-stone-500 font-normal">
                        Ta'minotchi qutiga solishda qalam bilan belgilashi uchun
                      </span>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-800 text-white font-bold">
                          <th className="py-2.5 px-2.5 text-center w-8">#</th>
                          <th className="py-2.5 px-2 text-center w-12">Qabul [✓]</th>
                          <th className="py-2.5 px-3 text-left">Tovar Nomi & Modeli</th>
                          <th className="py-2.5 px-2.5 text-left">Toifasi</th>
                          <th className="py-2.5 px-3 text-center bg-amber-600 text-white font-black text-sm">
                            Zakaz Soni
                          </th>
                          <th className="py-2.5 px-3 text-left">Izoh / Holati</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 font-medium">
                        {printableOrderItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-stone-400 italic">
                              Zakaz uchun tovarlar tanlanmagan yoki filtr bo'yicha topilmadi.
                            </td>
                          </tr>
                        ) : (
                          printableOrderItems.map((item, idx) => {
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                                <td className="py-2.5 px-2 text-center font-mono text-stone-400 text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <div className="w-5 h-5 border-2 border-stone-400 rounded-md mx-auto" />
                                </td>
                                <td className="py-2.5 px-3 font-bold text-stone-900 text-sm">
                                  {item.model}
                                </td>
                                <td className="py-2.5 px-2.5 text-stone-600 font-medium">
                                  {item.category}
                                </td>
                                <td className="py-2.5 px-3 text-center font-black text-stone-950 bg-amber-50 border-x border-amber-200 text-sm">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="py-2.5 px-3 text-stone-500 text-[11px]">
                                  {item.notes || (item.currentStock === 0 ? 'Tugagan (0 qoldi)' : '—')}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {printableOrderItems.length > 0 && (
                        <tfoot>
                          <tr className="bg-stone-100 font-black border-t-2 border-stone-300 text-stone-900">
                            <td colSpan={4} className="py-3 px-3 text-right uppercase text-xs">Jami Buyurtma:</td>
                            <td className="py-3 px-3 text-center font-black text-base text-amber-950 bg-amber-100/70 border-x border-amber-300 font-mono">
                              {totalOrderUnits} dona
                            </td>
                            <td className="py-3 px-3 text-xs text-stone-600 font-medium">
                              {printableOrderItems.length} xil tovar
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Supplier Requirements Note Box */}
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5 text-xs text-stone-700">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Ta'minotchi uchun talablar va qabul shartlari:
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Iltimos, har bir telefon modeliga mos, qutilari butun, yangi partiyadagi va sifatli aksessuarlarni solishingiz so'raladi. Yaroqsiz yoki nuqsonli tovarlar partiya kelgan zahoti qaytariladi.
                    </p>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 2: SAVDO VA KASSA HISOBOTI */}
              {reportType === 'daily_sales' && (
                <div className="space-y-6">
                  {/* Headline Banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                        {startDate === endDate ? `${startDate} Sanasi Uchun Kassa Tushumi` : `${startDate} dan ${endDate} gacha (${daysInRange} kunlik) Tushum`}
                      </div>
                      <div className="text-3xl font-black text-emerald-950 mt-1">
                        {formatMoney(salesStats.totalRevenue)}
                      </div>
                    </div>

                    {includeProfitInPdf && (
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                          Sof Foyda (Marja)
                        </div>
                        <div className="text-2xl font-black text-emerald-900 mt-1">
                          +{formatMoney(salesStats.totalProfit)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Methods Breakdown */}
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      To'lov Turlari Bo'yicha Taqsimot (Grafik):
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Cash */}
                      <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                        <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-between">
                          <span>💵 Naqd Pul</span>
                          <span className="font-mono">
                            {salesStats.totalRevenue > 0 ? Math.round((salesStats.cash / salesStats.totalRevenue) * 100) : 0}%
                          </span>
                        </div>
                        <div className="text-base font-black text-stone-900 mt-1">{formatMoney(salesStats.cash)}</div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${salesStats.totalRevenue > 0 ? (salesStats.cash / salesStats.totalRevenue) * 100 : 0}%` }} />
                        </div>
                      </div>

                      {/* Click/Payme */}
                      <div className="p-3 bg-white border border-sky-200 rounded-lg">
                        <div className="text-[11px] font-bold text-sky-700 flex items-center justify-between">
                          <span>💳 Click / Payme</span>
                          <span className="font-mono">
                            {salesStats.totalRevenue > 0 ? Math.round((salesStats.clickPayme / salesStats.totalRevenue) * 100) : 0}%
                          </span>
                        </div>
                        <div className="text-base font-black text-stone-900 mt-1">{formatMoney(salesStats.clickPayme)}</div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-sky-500 h-full" style={{ width: `${salesStats.totalRevenue > 0 ? (salesStats.clickPayme / salesStats.totalRevenue) * 100 : 0}%` }} />
                        </div>
                      </div>

                      {/* Uzum */}
                      <div className="p-3 bg-white border border-purple-200 rounded-lg">
                        <div className="text-[11px] font-bold text-purple-700 flex items-center justify-between">
                          <span>🍇 Uzum Nasiya</span>
                          <span className="font-mono">
                            {salesStats.totalRevenue > 0 ? Math.round((salesStats.uzum / salesStats.totalRevenue) * 100) : 0}%
                          </span>
                        </div>
                        <div className="text-base font-black text-stone-900 mt-1">{formatMoney(salesStats.uzum)}</div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-purple-500 h-full" style={{ width: `${salesStats.totalRevenue > 0 ? (salesStats.uzum / salesStats.totalRevenue) * 100 : 0}%` }} />
                        </div>
                      </div>

                      {/* Nasiya Debt */}
                      <div className="p-3 bg-white border border-amber-200 rounded-lg">
                        <div className="text-[11px] font-bold text-amber-700 flex items-center justify-between">
                          <span>📝 Nasiyaga Berilgan</span>
                          <span className="font-mono">
                            {salesStats.totalRevenue > 0 ? Math.round((salesStats.debt / salesStats.totalRevenue) * 100) : 0}%
                          </span>
                        </div>
                        <div className="text-base font-black text-stone-900 mt-1">{formatMoney(salesStats.debt)}</div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: `${salesStats.totalRevenue > 0 ? (salesStats.debt / salesStats.totalRevenue) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List of Sold Items */}
                  <div>
                    <div className="text-xs font-black text-stone-900 mb-2 flex items-center justify-between">
                      <span>SOTILGAN TOVARLAR TAFSILOTI ({filteredSalesMovements.length} ta sotuv):</span>
                      <span className="text-[11px] text-stone-500">Jami sotilgan: {salesStats.totalQuantity} dona</span>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-800 text-white font-bold">
                          <th className="py-2 px-2 text-center w-8">#</th>
                          <th className="py-2 px-2 text-center w-16">Sana / Vaqt</th>
                          <th className="py-2 px-3 text-left">Tovar Nomi</th>
                          <th className="py-2 px-2 text-left">Toifa</th>
                          <th className="py-2 px-2.5 text-left">Mijoz / Qayerga</th>
                          <th className="py-2 px-2 text-center">To'lov</th>
                          <th className="py-2 px-2 text-center">Soni</th>
                          <th className="py-2 px-3 text-right">Narxi</th>
                          <th className="py-2 px-3 text-right">Tushum</th>
                          {includeProfitInPdf && <th className="py-2 px-3 text-right text-emerald-300">Foyda</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 font-medium">
                        {filteredSalesMovements.length === 0 ? (
                          <tr>
                            <td colSpan={includeProfitInPdf ? 10 : 9} className="py-8 text-center text-stone-400 italic">
                              Belgilangan davr va filtrlar bo'yicha sotuv operatsiyalari topilmadi.
                            </td>
                          </tr>
                        ) : (
                          filteredSalesMovements.map((m, idx) => (
                            <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                              <td className="py-1.5 px-2 text-center font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                              <td className="py-1.5 px-2 text-center text-stone-500 font-mono text-[10px]">
                                {m.timestamp.slice(5, 10)} {m.timestamp.slice(11, 16)}
                              </td>
                              <td className="py-1.5 px-3 font-bold text-stone-900">
                                {m.productName}
                                {m.priceType === 'optom' && (
                                  <span className="ml-1 text-[9px] bg-purple-100 text-purple-800 font-bold px-1 rounded">
                                    OPTOM
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-stone-600 text-[11px]">{m.category}</td>
                              <td className="py-1.5 px-2.5 text-stone-600 text-[11px]">
                                {m.counterparty || 'Do\'kondan xaridor'}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  m.paymentMethod === 'naqd' ? 'bg-emerald-100 text-emerald-800' :
                                  m.paymentMethod === 'click_payme' ? 'bg-sky-100 text-sky-800' :
                                  m.paymentMethod === 'uzum' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {m.paymentMethod === 'naqd' ? 'Naqd' : m.paymentMethod === 'click_payme' ? 'Click' : m.paymentMethod === 'uzum' ? 'Uzum' : 'Nasiya'}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-center font-bold text-stone-900">{m.quantity}</td>
                              <td className="py-1.5 px-3 text-right font-mono text-stone-700">{formatMoney(m.unitPrice)}</td>
                              <td className="py-1.5 px-3 text-right font-bold font-mono text-stone-950">{formatMoney(m.totalRevenue)}</td>
                              {includeProfitInPdf && (
                                <td className="py-1.5 px-3 text-right font-bold font-mono text-emerald-700">
                                  +{formatMoney(m.profit)}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredSalesMovements.length > 0 && (
                        <tfoot>
                          <tr className="bg-stone-100 font-black border-t-2 border-stone-300 text-stone-900">
                            <td colSpan={6} className="py-2.5 px-3 text-right uppercase">Jami Tushum:</td>
                            <td className="py-2.5 px-2 text-center font-mono">{salesStats.totalQuantity} dona</td>
                            <td></td>
                            <td className="py-2.5 px-3 text-right font-mono text-base text-stone-950">
                              {formatMoney(salesStats.totalRevenue)}
                            </td>
                            {includeProfitInPdf && (
                              <td className="py-2.5 px-3 text-right font-mono text-base text-emerald-800">
                                +{formatMoney(salesStats.totalProfit)}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 3: OMBOR INVENTARIZATSIYASI VA QOLDIQLAR */}
              {reportType === 'stock_inventory' && (
                <div className="space-y-6">
                  {/* Valuation Highlights */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl">
                      <div className="text-[11px] font-bold text-stone-600">Tovar Turlari</div>
                      <div className="text-xl font-black text-stone-900">{inventoryStats.totalItemsCount} xil</div>
                      <div className="text-[10px] text-stone-500 mt-0.5">{inventoryStats.totalUnits} dona umumiy qoldiq</div>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-[11px] font-bold text-emerald-800">Tan Narx (Sarmoya)</div>
                      <div className="text-lg font-black text-emerald-950">{formatMoney(inventoryStats.totalPurchaseValue)}</div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Sof kapital qiymati</div>
                    </div>

                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                      <div className="text-[11px] font-bold text-sky-800">Chakana Sotuv Qiymati</div>
                      <div className="text-lg font-black text-sky-950">{formatMoney(inventoryStats.totalRetailValue)}</div>
                      <div className="text-[10px] text-sky-700 mt-0.5">Donalab sotilganda</div>
                    </div>

                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="text-[11px] font-bold text-purple-800">Optom Sotuv Qiymati</div>
                      <div className="text-lg font-black text-purple-950">{formatMoney(inventoryStats.totalWholesaleValue)}</div>
                      <div className="text-[10px] text-purple-700 mt-0.5">Ulgurji partiyalarda</div>
                    </div>
                  </div>

                  {/* Detailed Stock Products Table */}
                  <div>
                    <div className="text-xs font-black text-stone-900 mb-2 flex items-center justify-between">
                      <span>OMBOR TOVARLARI RO'YXATI ({filteredStockProducts.length} xil mahsulot):</span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {selectedCategoryFilter !== 'all' ? `Toifa: ${selectedCategoryFilter}` : 'Barcha toifalar'}
                      </span>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-800 text-white font-bold">
                          <th className="py-2 px-2 text-center w-8">#</th>
                          <th className="py-2 px-3 text-left">Tovar Nomi & Brendi</th>
                          <th className="py-2 px-2.5 text-left">Toifa</th>
                          <th className="py-2 px-2.5 text-center">Qoldiq</th>
                          <th className="py-2 px-3 text-right">Tan Narxi</th>
                          <th className="py-2 px-3 text-right">Chakana Narxi</th>
                          <th className="py-2 px-3 text-right">Optom Narxi</th>
                          <th className="py-2 px-3 text-right">Jami Tan Qiymat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 font-medium">
                        {filteredStockProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-stone-400 italic">
                              Tanlangan mezonlar bo'yicha tovarlar topilmadi.
                            </td>
                          </tr>
                        ) : (
                          filteredStockProducts.map((p, idx) => {
                            const totalTan = (Number(p.stock) || 0) * (Number(p.purchasePrice) || 0);

                            return (
                              <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                                <td className="py-1.5 px-2 text-center font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                                <td className="py-1.5 px-3 font-bold text-stone-900">
                                  {p.name}
                                  {p.brand && p.brand !== 'Universal' && (
                                    <span className="text-[10px] text-stone-500 font-normal ml-1">({p.brand})</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2.5 text-stone-600">{p.category}</td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    p.stock === 0 ? 'bg-rose-100 text-rose-800' :
                                    p.stock <= (p.minStockAlert || 5) ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-800'
                                  }`}>
                                    {p.stock} dona
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono text-stone-700">{formatMoney(p.purchasePrice)}</td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-800">{formatMoney(p.sellingPrice)}</td>
                                <td className="py-1.5 px-3 text-right font-mono text-purple-800">
                                  {formatMoney(p.wholesalePrice || Math.round(p.sellingPrice * 0.85))}
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold text-stone-900">{formatMoney(totalTan)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredStockProducts.length > 0 && (
                        <tfoot>
                          <tr className="bg-stone-100 font-black border-t-2 border-stone-300 text-stone-900">
                            <td colSpan={3} className="py-2.5 px-3 text-right uppercase">Jami:</td>
                            <td className="py-2.5 px-2.5 text-center font-mono">{inventoryStats.totalUnits} dona</td>
                            <td colSpan={3}></td>
                            <td className="py-2.5 px-3 text-right font-mono text-base text-emerald-900">
                              {formatMoney(inventoryStats.totalPurchaseValue)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 4: MIJOZLAR QARZLARI (NASIYALAR) */}
              {reportType === 'customer_debts' && (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-800 uppercase">Jami Mijozlardan Qaytarilishi Kerak Bo'lgan Nasiya</div>
                      <div className="text-2xl font-black text-amber-950 mt-0.5">{formatMoney(totalCustomerDebtSum)}</div>
                    </div>
                    <div className="text-right text-xs text-amber-800">
                      <span className="font-bold text-base text-amber-950">{activeCustomerDebts.length} nafar</span> faol qarzdor
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-800 text-white font-bold">
                        <th className="py-2 px-2.5 text-center w-8">#</th>
                        <th className="py-2 px-3 text-left">Mijoz Ismi</th>
                        <th className="py-2 px-3 text-left">Telefon Raqami</th>
                        <th className="py-2 px-3 text-right">Dastlabki Qarz</th>
                        <th className="py-2 px-3 text-right">To'langan</th>
                        <th className="py-2 px-3 text-right text-amber-300 font-black">Qolgan Qarz</th>
                        <th className="py-2 px-2.5 text-center">To'lash Muddati</th>
                        <th className="py-2 px-2 text-center">Holati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 font-medium">
                      {activeCustomerDebts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-stone-400 italic">
                            Hozirda do'konga qarzdor mijozlar mavjud emas.
                          </td>
                        </tr>
                      ) : (
                        activeCustomerDebts.map((debt, idx) => (
                            <tr key={debt.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                              <td className="py-2 px-2.5 text-center font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-stone-900">{debt.customerName}</td>
                              <td className="py-2 px-3 font-mono text-stone-700">{debt.customerPhone || '—'}</td>
                              <td className="py-2 px-3 text-right font-mono text-stone-600">{formatMoney(debt.totalDebt)}</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatMoney(debt.paidAmount)}</td>
                              <td className="py-2 px-3 text-right font-black font-mono text-amber-900 text-sm">
                                {formatMoney(debt.remainingAmount)}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono text-stone-700">{debt.dueDate || '—'}</td>
                              <td className="py-2 px-2 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                                  Faol
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* REPORT TYPE 5: TA'MINOTCHI QARZLARI */}
              {reportType === 'supplier_debts' && (
                <div className="space-y-6">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-rose-800 uppercase">Do'konimizning Ta'minotchilardan Jami Qarzi</div>
                      <div className="text-2xl font-black text-rose-950 mt-0.5">{formatMoney(totalSupplierDebtSum)}</div>
                    </div>
                    <div className="text-right text-xs text-rose-800">
                      <span className="font-bold text-base text-rose-950">{activeSupplierDebts.length} ta</span> to'lanmagan partiya
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-800 text-white font-bold">
                        <th className="py-2 px-2.5 text-center w-8">#</th>
                        <th className="py-2 px-3 text-left">Ta'minotchi / Diler</th>
                        <th className="py-2 px-3 text-left">Olingan Partiya / Tovar</th>
                        <th className="py-2 px-3 text-right">Jami Partiya Qiymati</th>
                        <th className="py-2 px-3 text-right">To'langan</th>
                        <th className="py-2 px-3 text-right text-rose-300 font-black">Bizning Qarzimiz</th>
                        <th className="py-2 px-2.5 text-center">Qaytarish Muddati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 font-medium">
                      {activeSupplierDebts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-stone-400 italic">
                            Ta'minotchilar oldida qarzdorliklar mavjud emas. Barcha partiyalar to'liq to'langan.
                          </td>
                        </tr>
                      ) : (
                        activeSupplierDebts.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                            <td className="py-2 px-2.5 text-center font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-stone-900">{item.supplierName}</td>
                            <td className="py-2 px-3 text-stone-700">{item.productSummary}</td>
                            <td className="py-2 px-3 text-right font-mono text-stone-600">{formatMoney(item.totalDebt)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatMoney(item.paidAmount)}</td>
                            <td className="py-2 px-3 text-right font-black font-mono text-rose-900 text-sm">
                              {formatMoney(item.remainingAmount)}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono text-stone-700">{item.dueDate || 'Kelishilmoqda'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* REPORT TYPE: KAM QOLGAN TOVARLAR (narxsiz; zakaz sonini qo'lda yozish uchun bo'sh ustun) */}
              {reportType === 'low_stock' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 p-3 rounded-xl bg-stone-50 border border-stone-200 text-sm">
                    <span>Jami: <strong className="text-stone-950">{lowStockProducts.length} xil tovar</strong></span>
                    <span>Tugagan (0): <strong className="text-rose-700">{lowStockProducts.filter((p) => p.stock <= 0).length} xil</strong></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-800 text-white text-left">
                          <th className="p-2 w-8 text-center">#</th>
                          <th className="p-2">Tovar nomi</th>
                          <th className="p-2">Toifasi</th>
                          <th className="p-2 text-center">Qoldiq</th>
                          <th className="p-2 text-center">Minimum</th>
                          <th className="p-2 text-center w-24">Zakaz soni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockProducts.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-stone-500">Kam qolgan tovar yo'q.</td></tr>
                        ) : (
                          lowStockProducts.map((p, idx) => (
                            <tr key={p.id} className="border-b border-stone-200 avoid-break">
                              <td className="p-2 text-center text-stone-500">{idx + 1}</td>
                              <td className="p-2 font-bold text-stone-900">{p.name}</td>
                              <td className="p-2 text-stone-600">{p.category}</td>
                              <td className={`p-2 text-center font-black ${p.stock <= 0 ? 'text-rose-700' : 'text-stone-900'}`}>{p.stock <= 0 ? 0 : p.stock}</td>
                              <td className="p-2 text-center text-stone-600">{p.minStockAlert || 0}</td>
                              <td className="p-2 border-l border-stone-300"></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Signatures and Official Store Stamp Footer */}
              <div className="pt-8 border-t-2 border-stone-200 flex items-end justify-between text-xs text-stone-700 avoid-break">
                <div className="space-y-4">
                  <div>
                    <span className="font-bold text-stone-800">Mas'ul hisobchi:</span> {storeInfo.accountantName}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Imzo:</span>
                    <span className="border-b border-stone-400 w-32 inline-block"></span>
                  </div>
                </div>

                <div className="text-center p-3 border border-dashed border-stone-300 rounded-xl w-36 h-20 flex flex-col items-center justify-center text-stone-400 text-[10px]">
                  <span>M.O'. (Do'kon Muhri)</span>
                </div>

                <div className="space-y-4 text-right">
                  <div>
                    <span className="font-bold text-stone-800">Do'kon rahbari:</span> Tasdiqlandi
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-stone-500">Imzo:</span>
                    <span className="border-b border-stone-400 w-32 inline-block"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success toast message if downloaded */}
        {downloadSuccessMessage && (
          <div className="no-print bg-emerald-600 text-white px-5 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{downloadSuccessMessage}</span>
          </div>
        )}

        {/* Footer Actions (No-print) */}
        <div className="no-print px-3 sm:px-7 py-2.5 sm:py-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex text-xs text-stone-400 items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {reportType === 'low_stock'
                ? "Narxsiz ro'yxat: «Zakaz soni» ustunini qo'lda to'ldirish mumkin."
                : reportType === 'out_of_stock'
                ? "Ta'minotchi rejimi faol (Narxlar berkitilgan, faqat model va zakaz soni)."
                : 'A4 formatiga moslashtirilgan. Rangli jadvallar bilan to\'g\'ridan-to\'g\'ri chop etish yoki yuklash mumkin.'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto [&>button]:justify-center">
            {reportType === 'out_of_stock' && (
              <button
                type="button"
                onClick={handleCopyTelegramOrder}
                className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
                title="Ta'minotchiga Telegram orqali yuborish uchun matnni nusxalash"
              >
                {copiedTelegramText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiedTelegramText ? 'Nusxalandi!' : 'Telegram Zakaz Matni'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
              title="PDF faylini to'liq ekran yangi oynada ochish"
            >
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Yangi Oynada Ochish</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
              title="Brauzer orqali to'g'ridan-to'g'ri printerga chiqarish yoki PDF sifatida saqlash"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Chop etish (Printer / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="col-span-2 order-first sm:order-none px-6 py-3 sm:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{isGeneratingPdf ? 'PDF Tayyorlanmoqda...' : '📥 Rangli PDF Yuklab Olish'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
