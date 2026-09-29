import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatMoney } from '../utils/formatters';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Layers, 
  ArrowRight, 
  Package, 
  Sparkles,
  Clipboard,
  RefreshCw,
  Info,
  Check,
  Edit2,
  Trash2,
  Plus,
  Search,
  Tag,
  Barcode,
  TrendingUp,
  Store,
  DollarSign
} from 'lucide-react';

export interface ExcelImportItem {
  id?: string;
  name: string;
  category: string;
  brand?: string;
  stock: number;
  purchasePrice: number;   // Kirim / Tan narxi
  sellingPrice: number;    // Chakana sotish narxi
  wholesalePrice?: number; // Optom sotish narxi
  barcode?: string;
  minStockAlert?: number;
  isExisting?: boolean;
  isValid: boolean;
  validationError?: string;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  categories: string[];
  onImportSuccess?: (
    items: {
      product: Product;
      isNew: boolean;
      addedStock: number;
    }[],
    createKirimRecord: boolean,
    supplierName: string,
    notes: string
  ) => void;
  onConfirmImport?: (
    items: {
      product: Product;
      isNew: boolean;
      addedStock: number;
    }[],
    createKirimRecord: boolean,
    supplierName: string,
    notes: string
  ) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  categories,
  onImportSuccess,
  onConfirmImport
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping states
  const [nameCol, setNameCol] = useState<string>('');
  const [categoryCol, setCategoryCol] = useState<string>('');
  const [stockCol, setStockCol] = useState<string>('');
  const [purchasePriceCol, setPurchasePriceCol] = useState<string>('');   // Kirim / Tan narxi
  const [sellingPriceCol, setSellingPriceCol] = useState<string>('');     // Chakana sotish narxi
  const [wholesalePriceCol, setWholesalePriceCol] = useState<string>(''); // Optom sotish narxi
  const [barcodeCol, setBarcodeCol] = useState<string>('');

  // Kirim settings
  const [stockHandling, setStockHandling] = useState<'add' | 'replace'>('add');
  const [updatePrices, setUpdatePrices] = useState<boolean>(true);
  const [createKirimMovements, setCreateKirimMovements] = useState<boolean>(true);
  const [supplierName, setSupplierName] = useState<string>('Ommaviy Kirim (Excel)');
  const [notes, setNotes] = useState<string>('Excel orqali ommaviy yuklandi');

  // Search in preview
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable items state
  const [items, setItems] = useState<ExcelImportItem[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [modalEditItem, setModalEditItem] = useState<ExcelImportItem | null>(null);

  // Helper to parse numbers safely
  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const cleanStr = String(val)
      .replace(/\s+/g, '')
      .replace(/so'?m/gi, '')
      .replace(/\$/g, '')
      .replace(/,/g, '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Full reset function for repeated imports
  const resetData = () => {
    setRawHeaders([]);
    setRawRows([]);
    setFileName('');
    setPastedText('');
    setSuccessMessage(null);
    setImporting(false);
    setPreviewSearch('');
    setItems([]);
    setEditingRowIndex(null);
    setModalEditItem(null);
    setNameCol('');
    setCategoryCol('');
    setStockCol('');
    setPurchasePriceCol('');
    setSellingPriceCol('');
    setWholesalePriceCol('');
    setBarcodeCol('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clean reset when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      resetData();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetData();
    onClose();
  };

  // Smart detect columns based on header strings
  const autoDetectColumns = (headers: string[]) => {
    let detectedName = '';
    let detectedCategory = '';
    let detectedStock = '';
    let detectedPurchase = '';
    let detectedSelling = '';
    let detectedWholesale = '';
    let detectedBarcode = '';

    headers.forEach((h) => {
      const lower = h.trim().toLowerCase();
      // Name
      if (!detectedName && (lower.includes('nom') || lower.includes('tovar') || lower.includes('name') || lower.includes('наименов') || lower.includes('товар') || lower.includes('model'))) {
        detectedName = h;
      }
      // Category
      else if (!detectedCategory && (lower.includes('kategor') || lower.includes('bolim') || lower.includes('katalog') || lower.includes('category') || lower.includes('категор') || lower.includes('вид'))) {
        detectedCategory = h;
      }
      // Stock / Quantity
      else if (!detectedStock && (lower.includes('son') || lower.includes('miqdor') || lower.includes('dona') || lower.includes('qoldiq') || lower.includes('qty') || lower.includes('count') || lower.includes('кол') || lower.includes('остаток'))) {
        detectedStock = h;
      }
      // Kirim / Tan narxi (Purchase price)
      else if (!detectedPurchase && (lower.includes('tan') || lower.includes('kirim') || lower.includes('tannarx') || lower.includes('zakup') || lower.includes('закуп') || lower.includes('себестоим') || lower.includes('cost') || lower.includes('buy'))) {
        detectedPurchase = h;
      }
      // Optom sotish narxi (Wholesale price)
      else if (!detectedWholesale && (lower.includes('optom') || lower.includes('ulgurji') || lower.includes('wholesale') || lower.includes('опт'))) {
        detectedWholesale = h;
      }
      // Chakana sotish narxi (Retail selling price)
      else if (!detectedSelling && (lower.includes('chakana') || lower.includes('sotish') || lower.includes('narx') || lower.includes('price') || lower.includes('розниц') || lower === 'цена' || lower.includes('sotuv'))) {
        detectedSelling = h;
      }
      // Barcode
      else if (!detectedBarcode && (lower.includes('kod') || lower.includes('barcode') || lower.includes('barkod') || lower.includes('штрих') || lower.includes('артикул'))) {
        detectedBarcode = h;
      }
    });

    // Fallbacks if not detected by keywords:
    if (!detectedName && headers[0]) detectedName = headers[0];
    if (!detectedCategory && headers[1]) detectedCategory = headers[1];
    if (!detectedStock && headers[2]) detectedStock = headers[2];
    if (!detectedPurchase && headers[3]) detectedPurchase = headers[3];
    if (!detectedSelling && headers[4]) detectedSelling = headers[4];

    setNameCol(detectedName);
    setCategoryCol(detectedCategory);
    setStockCol(detectedStock);
    setPurchasePriceCol(detectedPurchase);
    setSellingPriceCol(detectedSelling);
    setWholesalePriceCol(detectedWholesale);
    setBarcodeCol(detectedBarcode);
  };

  // Process XLSX / CSV file buffer
  const processWorkbook = (wb: XLSX.WorkBook, sourceName: string) => {
    try {
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        alert('Fayl bo\'sh yoki unda tovar ma\'lumotlari topilmadi!');
        return;
      }

      const headers = Object.keys(json[0] || {});
      setRawHeaders(headers);
      setRawRows(json);
      setFileName(sourceName);
      autoDetectColumns(headers);
    } catch (err) {
      console.error('File parsing error', err);
      alert('Faylni o\'qishda xatolik yuz berdi. Iltimos to\'g\'ri Excel yoki CSV fayl yuklang.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Xavfsizlik: Fayl hajmi 15MB dan oshmasligi kerak!');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        processWorkbook(wb, file.name);
      } catch (err) {
        console.error('File read error:', err);
        alert('Faylni o\'qishda xatolik yuz berdi!');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input value so selecting another file or re-selecting triggers onChange
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Xavfsizlik: Fayl hajmi 15MB dan oshmasligi kerak!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        processWorkbook(wb, file.name);
      } catch (err) {
        console.error('File drop read error:', err);
        alert('Faylni o\'qishda xatolik yuz berdi!');
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle parsing pasted spreadsheet text (e.g. from Excel Ctrl+C or Telegram table)
  const handleParsePastedText = () => {
    const text = pastedText.trim();
    if (!text) {
      alert('Iltimos, avval matn yoki jadvalni nusxalab bu yerga qo\'ying!');
      return;
    }

    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        alert('Jadvalda kamida sarlavha va 1 qator ma\'lumot bo\'lishi kerak!');
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const rows: Record<string, any>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, colIdx) => {
          if (h && h !== '__proto__' && h !== 'constructor' && h !== 'prototype') {
            rowObj[h] = cols[colIdx] || '';
          }
        });
        rows.push(rowObj);
      }

      setRawHeaders(headers);
      setRawRows(rows);
      setFileName('Nusxalangan Jadval Matni');
      autoDetectColumns(headers);
    } catch (err) {
      console.error('Paste parse error', err);
      alert('Matnni jadvalga aylantirishda xatolik yuz berdi. Iltimos ustunlarni tekshiring.');
    }
  };

  // Convert raw rows and mappings into editable items
  useEffect(() => {
    if (rawRows.length === 0 || !nameCol) {
      setItems([]);
      return;
    }

    const generated: ExcelImportItem[] = rawRows.map((row, idx) => {
      const name = String(row[nameCol] || '').trim();
      const rawCat = categoryCol ? String(row[categoryCol] || '').trim() : '';
      const category = rawCat || 'Aksessuarlar';
      const stock = stockCol ? Math.max(0, Math.round(parseNumber(row[stockCol]))) : 10;
      const purchasePrice = purchasePriceCol ? Math.max(0, Math.round(parseNumber(row[purchasePriceCol]))) : 0;
      let sellingPrice = sellingPriceCol ? Math.max(0, Math.round(parseNumber(row[sellingPriceCol]))) : 0;
      let wholesalePrice = wholesalePriceCol ? Math.max(0, Math.round(parseNumber(row[wholesalePriceCol]))) : 0;

      // Smart default retail price if missing: +40% markup
      if (sellingPrice === 0 && purchasePrice > 0) {
        sellingPrice = Math.round((purchasePrice * 1.4) / 1000) * 1000;
      }
      // Smart default wholesale price if missing: 15% discount from retail
      if (wholesalePrice === 0 && sellingPrice > 0) {
        wholesalePrice = Math.round((sellingPrice * 0.85) / 1000) * 1000;
      }

      const barcode = barcodeCol ? String(row[barcodeCol] || '').trim() : undefined;

      const existing = existingProducts.find(
        (p) => (p?.name && p.name.trim().toLowerCase() === name.toLowerCase()) ||
               (barcode && p?.barcode && String(p.barcode).trim() === barcode)
      );

      const isValid = name.length > 1;
      const validationError = !name ? 'Tovar nomi kiritilmagan' : undefined;

      return {
        id: existing?.id,
        name,
        category,
        stock,
        purchasePrice,
        sellingPrice,
        wholesalePrice,
        barcode: barcode || existing?.barcode,
        isExisting: !!existing,
        isValid,
        validationError
      };
    });

    setItems(generated);
  }, [rawRows, nameCol, categoryCol, stockCol, purchasePriceCol, sellingPriceCol, wholesalePriceCol, barcodeCol, existingProducts]);

  // Edit item inline
  const handleUpdateItem = (index: number, field: keyof ExcelImportItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      const current = { ...copy[index], [field]: value };
      if (field === 'name') {
        current.isValid = String(value).trim().length > 1;
        current.validationError = current.isValid ? undefined : 'Tovar nomi kiritilmagan';
      }
      copy[index] = current;
      return copy;
    });
  };

  // Delete row
  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add new blank row
  const handleAddNewItem = () => {
    const newItem: ExcelImportItem = {
      name: 'Yangi tovar',
      category: categories[0] || 'Aksessuarlar',
      stock: 10,
      purchasePrice: 10000,
      sellingPrice: 15000,
      wholesalePrice: 13000,
      isValid: true
    };
    setItems((prev) => [newItem, ...prev]);
  };

  // Bulk pricing actions
  const applyBulkChakanaMarkup = (percent: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.purchasePrice > 0) {
          const newSelling = Math.round((item.purchasePrice * (1 + percent / 100)) / 1000) * 1000;
          return { ...item, sellingPrice: newSelling };
        }
        return item;
      })
    );
  };

  const applyBulkWholesaleDiscount = (percent: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.sellingPrice > 0) {
          const newWholesale = Math.round((item.sellingPrice * (1 - percent / 100)) / 1000) * 1000;
          return { ...item, wholesalePrice: newWholesale };
        }
        return item;
      })
    );
  };

  // Statistics
  const validCount = items.filter((i) => i.isValid).length;
  const existingCount = items.filter((i) => i.isValid && i.isExisting).length;
  const newCount = validCount - existingCount;
  const totalStockQuantity = items.filter((i) => i.isValid).reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
  const totalPurchaseValue = items.filter((i) => i.isValid).reduce((sum, i) => sum + ((Number(i.stock) || 0) * (Number(i.purchasePrice) || 0)), 0);
  const totalChakanaValue = items.filter((i) => i.isValid).reduce((sum, i) => sum + ((Number(i.stock) || 0) * (Number(i.sellingPrice) || 0)), 0);
  const totalWholesaleValue = items.filter((i) => i.isValid).reduce((sum, i) => sum + ((Number(i.stock) || 0) * (Number(i.wholesalePrice) || 0)), 0);

  // Filtered for preview search
  const filteredPreviewItems = useMemo(() => {
    if (!previewSearch.trim()) return items;
    const q = previewSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q))
    );
  }, [items, previewSearch]);

  // Download Sample Excel Template with explicit 3 prices
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Tovar Nomi': 'iPhone 13 Pro Max Shisha (Remax 9D)',
        'Kategoriya': 'Himoya Oynalari',
        'Qoldiq (Dona)': 30,
        'Kirim Narxi (Tan)': 18000,
        'Chakana Sotish Narxi': 35000,
        'Optom Sotish Narxi': 28000,
        'Shtrix-kod': '4780012345678'
      },
      {
        'Tovar Nomi': 'Samsung Type-C Tezkor Zaryadlovchi 25W',
        'Kategoriya': 'Zaryadkalar',
        'Qoldiq (Dona)': 20,
        'Kirim Narxi (Tan)': 45000,
        'Chakana Sotish Narxi': 80000,
        'Optom Sotish Narxi': 65000,
        'Shtrix-kod': '4780012345679'
      },
      {
        'Tovar Nomi': 'Silikon Chexol Clear (iPhone 14)',
        'Kategoriya': 'Chexollar',
        'Qoldiq (Dona)': 50,
        'Kirim Narxi (Tan)': 12000,
        'Chakana Sotish Narxi': 25000,
        'Optom Sotish Narxi': 18000,
        'Shtrix-kod': '4780012345680'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tovarlar_Kirim');
    XLSX.writeFile(wb, 'Telefon_Aksessuarlar_Namuna_Kirim.xlsx');
  };

  // Open modal row editor
  const handleOpenRowEditModal = (item: ExcelImportItem, idx: number) => {
    setEditingRowIndex(idx);
    setModalEditItem({ ...item });
  };

  const handleSaveModalRowEdit = () => {
    if (editingRowIndex === null || !modalEditItem) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[editingRowIndex] = {
        ...modalEditItem,
        isValid: modalEditItem.name.trim().length > 1,
        validationError: modalEditItem.name.trim().length > 1 ? undefined : 'Tovar nomi kiritilmagan'
      };
      return copy;
    });
    setEditingRowIndex(null);
    setModalEditItem(null);
  };

  // Execute import
  const handleExecuteImport = () => {
    const validItems = items.filter((i) => i.isValid);
    if (validItems.length === 0) {
      alert('Yuklash uchun yaroqli tovarlar topilmadi!');
      return;
    }

    setImporting(true);

    try {
      const itemsToImport: {
        product: Product;
        isNew: boolean;
        addedStock: number;
      }[] = [];

      validItems.forEach((item, index) => {
        const existing = existingProducts.find(
          (p) => (p?.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()) ||
                 (item.barcode && p?.barcode && String(p.barcode).trim() === String(item.barcode).trim())
        );

        if (existing) {
          const prevStock = Number(existing.stock) || 0;
          const incomingStock = Number(item.stock) || 0;
          const finalStock = stockHandling === 'add' 
            ? prevStock + incomingStock 
            : incomingStock;

          const updatedProduct: Product = {
            ...existing,
            name: String(item.name || existing.name || '').trim(),
            brand: String(existing.brand || item.brand || 'Universal').trim(),
            stock: Math.max(0, finalStock),
            purchasePrice: updatePrices ? (Number(item.purchasePrice) || Number(existing.purchasePrice) || 0) : (Number(existing.purchasePrice) || 0),
            sellingPrice: updatePrices ? (Number(item.sellingPrice) || Number(existing.sellingPrice) || 0) : (Number(existing.sellingPrice) || 0),
            wholesalePrice: updatePrices ? (Number(item.wholesalePrice) || Number(existing.wholesalePrice) || 0) : (Number(existing.wholesalePrice) || 0),
            barcode: String(item.barcode || existing.barcode || '').trim(),
            category: String(item.category || existing.category || 'Aksessuarlar').trim(),
            minStockAlert: Number(existing.minStockAlert) || 5
          };

          itemsToImport.push({
            product: updatedProduct,
            isNew: false,
            addedStock: incomingStock
          });
        } else {
          const newProduct: Product = {
            id: `prod-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
            name: String(item.name || '').trim(),
            category: String(item.category || 'Aksessuarlar').trim(),
            brand: String(item.brand || 'Universal').trim(),
            stock: Math.max(0, Number(item.stock) || 0),
            purchasePrice: Math.max(0, Number(item.purchasePrice) || 0),
            sellingPrice: Math.max(0, Number(item.sellingPrice) || 0),
            wholesalePrice: Math.max(0, Number(item.wholesalePrice) || Math.round((Number(item.sellingPrice) || 0) * 0.85)),
            barcode: String(item.barcode || `880${Math.floor(100000000 + Math.random() * 900000000)}`).trim(),
            minStockAlert: Math.max(1, Number(item.minStockAlert) || 5)
          };

          itemsToImport.push({
            product: newProduct,
            isNew: true,
            addedStock: Math.max(0, Number(item.stock) || 0)
          });
        }
      });

      const callback = onImportSuccess || onConfirmImport;
      if (typeof callback === 'function') {
        callback(itemsToImport, createKirimMovements, supplierName, notes);
      } else {
        console.warn('No callback found for Excel import');
      }

      setSuccessMessage(`${itemsToImport.length} ta tovar muvaffaqiyatli omborga kiritildi!`);
      setImporting(false);
    } catch (err) {
      console.error('Import execution error', err);
      alert('Tovarlarni saqlashda xatolik yuz berdi!');
      setImporting(false);
    }
  };

  // Rule of hooks: early return MUST be at the very bottom before JSX return!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        id="excel-import-modal-card"
        className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 bg-gradient-to-r from-emerald-950/70 via-stone-900 to-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Excel / CSV Ommaviy Tovar Yuklash</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Tezkor Kirim & Tahrirlash
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Minglab tovarlarni jadvaldan kiritish, narxlarini (Kirim, Chakana, Optom) alohida tahrirlash
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {successMessage ? (
            /* SUCCESS VIEW */
            <div className="py-16 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-lg shadow-emerald-950/50">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">{successMessage}</h3>
                <p className="text-stone-400 text-sm max-w-md mx-auto">
                  Ombor qoldiqlari yangilandi va barcha tovarlar kirim harakatlari jurnaliga qayd etildi.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetData}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Yana Boshqa Excel Fayl Yuklash</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  Oynani Yopish
                </button>
              </div>
            </div>
          ) : rawRows.length === 0 ? (
            /* STEP 1: Select or Paste File */
            <div className="space-y-5">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 p-1.5 bg-stone-950 rounded-2xl border border-stone-800 max-w-md">
                <button
                  onClick={() => setActiveTab('file')}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'file'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel / CSV Fayl Yuklash</span>
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Clipboard className="w-4 h-4" />
                  <span>Matn / Jadval Nusxalash</span>
                </button>
              </div>

              {activeTab === 'file' ? (
                /* Drag & Drop Box */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
                      : 'border-stone-800 bg-stone-950/60 hover:border-emerald-500/50 hover:bg-stone-950'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                    Excel (.xlsx, .xls) yoki CSV faylni shu yerga tashlang
                  </h3>
                  <p className="text-xs text-stone-400 max-w-md mx-auto mb-4">
                    Faylni tanlash uchun bosing yoki faylingizni to'g'ridan-to'g'ri sudrab tashlang
                  </p>
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                    Kompyuterdan fayl tanlash
                  </span>
                </div>
              ) : (
                /* Paste Table Text Box */
                <div className="space-y-3">
                  <div className="p-3 bg-stone-950/80 border border-stone-800 rounded-2xl text-xs text-stone-300">
                    <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Qanday ishlaydi?
                    </div>
                    Excel yoki Telegramdagi jadval qatorlarini belgilab <b>Ctrl+C</b> bilan nusxalang va quyidagi maydonga <b>Ctrl+V</b> qilib tashlang.
                  </div>

                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Tovar Nomi	Kategoriya	Soni	Kirim Narxi	Chakana Narxi	Optom Narxi	Shtrix-kod&#10;iPhone 13 Shisha	Himoya Oynalari	30	18000	35000	28000	47800123"
                    className="w-full bg-stone-950 border border-stone-800 rounded-2xl p-4 text-xs font-mono text-stone-200 focus:border-emerald-500 focus:outline-none"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleParsePastedText}
                      disabled={!pastedText.trim()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Jadvalni Tahlil Qilish</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sample Template & Help Box */}
              <div className="p-4 sm:p-5 bg-stone-950/80 border border-stone-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-200">Tayyor 3 xil narxli Excel shablon kerakmi?</h4>
                    <p className="text-[11px] text-stone-400 leading-relaxed mt-0.5">
                      Kirim (Tan) narx, Chakana sotish narxi va Optom sotish narxi alohida ustunlarga ega namunaviy Excel faylni yuklab oling.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadSample}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-emerald-400 text-xs font-bold rounded-xl border border-stone-700 flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Namuna Excel Shabloni (.xlsx)</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Column Mapping & Data Preview & Editing */
            <div className="space-y-6">
              {/* File Info Bar with Switch / Reset Button */}
              <div className="p-4 bg-stone-950 border border-stone-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{fileName || 'Yuklangan Fayl'}</span>
                      <span className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-md font-mono">
                        {rawRows.length} ta qator
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Ustunlar aniqlandi. Quyida tovarlar narxini (Kirim, Chakana, Optom) bemalol tahrirlashingiz mumkin.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetData}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Faylni almashtirish"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Boshqa fayl tanlash</span>
                </button>
              </div>

              {/* Column Mapping Section */}
              <div className="p-4 sm:p-5 bg-stone-950/70 border border-stone-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black text-white">
                      Ustunlarni moslashtirish (Fayldagi sarlavhalar)
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-400">
                    Avtomatik aniqlangan, kerak bo'lsa o'zgartiring
                  </span>
                </div>

                {/* 1. Basic Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Name Col */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-300 block mb-1">
                      Tovar nomi ustuni <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={nameCol}
                      onChange={(e) => setNameCol(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 text-white rounded-xl px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">(Tanlang)</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category Col */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-300 block mb-1">
                      Kategoriya ustuni
                    </label>
                    <select
                      value={categoryCol}
                      onChange={(e) => setCategoryCol(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 text-white rounded-xl px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">(Default: Aksessuarlar)</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stock Col */}
                  <div>
                    <label className="text-[11px] font-bold text-stone-300 block mb-1">
                      Soni (Qoldiq) ustuni
                    </label>
                    <select
                      value={stockCol}
                      onChange={(e) => setStockCol(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 text-white rounded-xl px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">(Default: 10 dona)</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. THREE DEDICATED DISTINCT PRICE COLUMNS ("addelno tursin") */}
                <div className="pt-2 border-t border-stone-800/80">
                  <div className="text-[11px] font-bold text-stone-400 mb-2.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>3 XIL NARX USTUNLARI (Alohida belgilash):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Kirim / Tan Narxi */}
                    <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          🟢 Kirim Narxi (Tan narx)
                        </label>
                      </div>
                      <p className="text-[10px] text-stone-400">Tovarning do'konga tushgan asl narxi</p>
                      <select
                        value={purchasePriceCol}
                        onChange={(e) => setPurchasePriceCol(e.target.value)}
                        className="w-full bg-stone-900 border border-emerald-700/60 text-emerald-300 font-semibold rounded-lg px-2 py-1.5 text-xs focus:border-emerald-400 focus:outline-none mt-1"
                      >
                        <option value="">(Tan narx yo'q: 0 so'm)</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Chakana Sotish Narxi */}
                    <div className="p-3 bg-sky-950/20 border border-sky-800/40 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                          🔵 Chakana Sotish Narxi
                        </label>
                      </div>
                      <p className="text-[10px] text-stone-400">Oddiy xaridorga donalab sotish narxi</p>
                      <select
                        value={sellingPriceCol}
                        onChange={(e) => setSellingPriceCol(e.target.value)}
                        className="w-full bg-stone-900 border border-sky-700/60 text-sky-300 font-semibold rounded-lg px-2 py-1.5 text-xs focus:border-sky-400 focus:outline-none mt-1"
                      >
                        <option value="">(Avtomat: Tan narx +40%)</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Optom Sotish Narxi */}
                    <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-purple-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                          🟣 Optom Sotish Narxi
                        </label>
                      </div>
                      <p className="text-[10px] text-stone-400">Ulgurji / ko'p oluvchilar uchun maxsus narx</p>
                      <select
                        value={wholesalePriceCol}
                        onChange={(e) => setWholesalePriceCol(e.target.value)}
                        className="w-full bg-stone-900 border border-purple-700/60 text-purple-300 font-semibold rounded-lg px-2 py-1.5 text-xs focus:border-purple-400 focus:outline-none mt-1"
                      >
                        <option value="">(Avtomat: Chakana -15%)</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Barcode & Quick Pricing Helpers */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-stone-400">Shtrix-kod ustuni:</span>
                    <select
                      value={barcodeCol}
                      onChange={(e) => setBarcodeCol(e.target.value)}
                      className="bg-stone-900 border border-stone-700 text-stone-300 rounded-lg px-2.5 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">(Ixtiyoriy / Avtomat)</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-400">Tezkor ustama:</span>
                    <button
                      type="button"
                      onClick={() => applyBulkChakanaMarkup(30)}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-sky-300 border border-stone-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      title="Chakana narxni tan narxdan 30% ga oshirish"
                    >
                      Chakana +30%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBulkChakanaMarkup(40)}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-sky-300 border border-stone-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      title="Chakana narxni tan narxdan 40% ga oshirish"
                    >
                      Chakana +40%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBulkWholesaleDiscount(15)}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-purple-300 border border-stone-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      title="Optom narxni chakanadan 15% arzon qilish"
                    >
                      Optom -15%
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-950 border border-stone-800 rounded-2xl">
                  <div className="text-[11px] text-stone-400 font-semibold">Jami tovarlar</div>
                  <div className="text-xl font-black text-white">{validCount} ta</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">{totalStockQuantity} dona umumiy qoldiq</div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl">
                  <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Jami Kirim (Tan) Qiymati
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-300">{formatMoney(totalPurchaseValue)}</div>
                  <div className="text-[10px] text-emerald-500/80 mt-0.5">Do'konga tushish xarajati</div>
                </div>

                <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-2xl">
                  <div className="text-[11px] text-sky-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Jami Chakana Qiymati
                  </div>
                  <div className="text-base sm:text-lg font-black text-sky-300">{formatMoney(totalChakanaValue)}</div>
                  <div className="text-[10px] text-sky-500/80 mt-0.5">Donalab sotish kutilmasi</div>
                </div>

                <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-2xl">
                  <div className="text-[11px] text-purple-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Jami Optom Qiymati
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-300">{formatMoney(totalWholesaleValue)}</div>
                  <div className="text-[10px] text-purple-500/80 mt-0.5">Ulgurji sotish kutilmasi</div>
                </div>
              </div>

              {/* Preview & In-Table Editing */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xs font-black text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      Tovarlarni jadvalda tahrirlash va tasdiqlash
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 text-[10px] font-mono">
                      {filteredPreviewItems.length} ta ko'rsatilmoqda
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                      <input
                        type="text"
                        placeholder="Qidirish (nom, barkod)..."
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddNewItem}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tovar qo'shish</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-stone-800 rounded-2xl overflow-hidden bg-stone-950 shadow-inner">
                  <div className="max-h-80 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                      <thead className="bg-stone-900/95 sticky top-0 z-10 border-b border-stone-800 text-[11px] text-stone-400 font-bold">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Tovar Nomi</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Kategoriya</th>
                          <th className="py-2.5 px-3 w-20 text-center">Soni</th>
                          <th className="py-2.5 px-3 min-w-[130px] text-emerald-400">🟢 Kirim (Tan) Narx</th>
                          <th className="py-2.5 px-3 min-w-[130px] text-sky-400">🔵 Chakana Narx</th>
                          <th className="py-2.5 px-3 min-w-[130px] text-purple-400">🟣 Optom Narx</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Shtrix-kod</th>
                          <th className="py-2.5 px-3 w-16 text-center">Amal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/60 font-medium">
                        {filteredPreviewItems.slice(0, 150).map((item, idx) => {
                          // Find true index in parent items array
                          const trueIndex = items.indexOf(item);

                          return (
                            <tr key={idx} className="hover:bg-stone-900/40 transition-colors">
                              <td className="py-2 px-3 text-center text-stone-500 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Name input */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(trueIndex, 'name', e.target.value)}
                                  placeholder="Tovar nomi..."
                                  className={`w-full bg-stone-900/80 border text-white font-semibold rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 ${
                                    !item.isValid ? 'border-rose-500/80 bg-rose-950/20' : 'border-stone-800'
                                  }`}
                                />
                                {item.isExisting && (
                                  <span className="text-[10px] text-amber-400 font-medium block mt-0.5 ml-1">
                                    ★ Mavjud tovar (qoldiq qo'shiladi)
                                  </span>
                                )}
                              </td>

                              {/* Category select / text */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  list={`cat-list-${idx}`}
                                  value={item.category}
                                  onChange={(e) => handleUpdateItem(trueIndex, 'category', e.target.value)}
                                  className="w-full bg-stone-900/80 border border-stone-800 text-stone-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                />
                                <datalist id={`cat-list-${idx}`}>
                                  {categories.map((c) => (
                                    <option key={c} value={c} />
                                  ))}
                                </datalist>
                              </td>

                              {/* Quantity input */}
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.stock}
                                  onChange={(e) => handleUpdateItem(trueIndex, 'stock', Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-16 text-center bg-stone-900/80 border border-stone-800 text-white font-bold rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </td>

                              {/* 1. Kirim / Tan Narxi */}
                              <td className="py-1.5 px-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="500"
                                    value={item.purchasePrice}
                                    onChange={(e) => handleUpdateItem(trueIndex, 'purchasePrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-emerald-950/20 border border-emerald-800/60 text-emerald-300 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-400 text-right"
                                  />
                                </div>
                              </td>

                              {/* 2. Chakana Sotish Narxi */}
                              <td className="py-1.5 px-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="500"
                                    value={item.sellingPrice}
                                    onChange={(e) => handleUpdateItem(trueIndex, 'sellingPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-sky-950/20 border border-sky-800/60 text-sky-300 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-400 text-right"
                                  />
                                </div>
                              </td>

                              {/* 3. Optom Sotish Narxi */}
                              <td className="py-1.5 px-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="500"
                                    value={item.wholesalePrice || 0}
                                    onChange={(e) => handleUpdateItem(trueIndex, 'wholesalePrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-purple-950/20 border border-purple-800/60 text-purple-300 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-400 text-right"
                                  />
                                </div>
                              </td>

                              {/* Barcode */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={item.barcode || ''}
                                  onChange={(e) => handleUpdateItem(trueIndex, 'barcode', e.target.value)}
                                  placeholder="Shtrix-kod..."
                                  className="w-full bg-stone-900/80 border border-stone-800 text-stone-400 font-mono text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                                />
                              </td>

                              {/* Actions */}
                              <td className="py-1.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRowEditModal(item, trueIndex)}
                                    className="p-1 rounded-md text-stone-400 hover:text-sky-400 hover:bg-stone-800 transition-colors cursor-pointer"
                                    title="Kengaytirilgan tahrirlash"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(trueIndex)}
                                    className="p-1 rounded-md text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
                                    title="Qatorni o'chirish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 flex items-center justify-between px-1">
                  <span>💡 Jadvaldagi istalgan katakchani bosib qiymatlarni (nom, narx, soni) to'g'ridan-to'g'ri o'zgartirishingiz mumkin.</span>
                  {filteredPreviewItems.length > 150 && (
                    <span className="text-amber-400 font-semibold">150 ta qator ko'rsatildi (qolganlari ham saqlanadi)</span>
                  )}
                </div>
              </div>

              {/* Kirim Details & Settings */}
              <div className="p-4 bg-stone-950 border border-stone-800 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  Kirim partiyasi va yetkazib beruvchi ma'lumotlari
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Yetkazib beruvchi / Ta'minotchi nomi
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Masalan: Abu Saxiy bozor / Ommaviy kirim"
                      className="w-full bg-stone-900 border border-stone-700 text-white rounded-xl px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Kirim izohi
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Izoh yozing..."
                      className="w-full bg-stone-900 border border-stone-700 text-white rounded-xl px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-stone-800/80 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-stone-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={createKirimMovements}
                      onChange={(e) => setCreateKirimMovements(e.target.checked)}
                      className="rounded border-stone-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-stone-900"
                    />
                    <span>Kirim partiyasini kirim harakatlari jurnaliga qo'shish</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-stone-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={updatePrices}
                      onChange={(e) => setUpdatePrices(e.target.checked)}
                      className="rounded border-stone-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-stone-900"
                    />
                    <span>Mavjud tovarlarning narxlarini ham yangilash</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {rawRows.length > 0 && !successMessage && (
          <div className="px-5 sm:px-7 py-4 bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-stone-400 text-center sm:text-left">
              <span className="font-bold text-white">{validCount} ta</span> yaroqli tovar omborga kiritiladi.
              Kutilayotgan kirim qiymati: <span className="font-bold text-emerald-400">{formatMoney(totalPurchaseValue)}</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing || validCount === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Omborga kiritilmoqda...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Hammasini Omborga Kiritish ({validCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* DEDICATED ROW EDIT MODAL (when clicked "Edit" icon on row) */}
        {modalEditItem && editingRowIndex !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
            <div className="bg-stone-900 border border-stone-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Tovarni batafsil tahrirlash</h3>
                </div>
                <button
                  onClick={() => {
                    setEditingRowIndex(null);
                    setModalEditItem(null);
                  }}
                  className="p-1 text-stone-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-stone-400 font-bold block mb-1">Tovar Nomi</label>
                  <input
                    type="text"
                    value={modalEditItem.name}
                    onChange={(e) => setModalEditItem({ ...modalEditItem, name: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white font-semibold focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-stone-400 font-bold block mb-1">Kategoriya</label>
                    <input
                      type="text"
                      value={modalEditItem.category}
                      onChange={(e) => setModalEditItem({ ...modalEditItem, category: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 font-bold block mb-1">Soni (Dona)</label>
                    <input
                      type="number"
                      min="0"
                      value={modalEditItem.stock}
                      onChange={(e) => setModalEditItem({ ...modalEditItem, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* The 3 Prices */}
                <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-2.5">
                  <div className="text-[11px] font-bold text-stone-400">3 Xil Narx:</div>
                  <div>
                    <label className="text-emerald-400 font-bold block mb-1">🟢 Kirim Narxi (Tan Narx)</label>
                    <input
                      type="number"
                      min="0"
                      value={modalEditItem.purchasePrice}
                      onChange={(e) => setModalEditItem({ ...modalEditItem, purchasePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full bg-stone-900 border border-emerald-800/80 text-emerald-300 font-bold rounded-xl px-3 py-2 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sky-400 font-bold block mb-1">🔵 Chakana Sotish Narxi</label>
                    <input
                      type="number"
                      min="0"
                      value={modalEditItem.sellingPrice}
                      onChange={(e) => setModalEditItem({ ...modalEditItem, sellingPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full bg-stone-900 border border-sky-800/80 text-sky-300 font-bold rounded-xl px-3 py-2 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-purple-400 font-bold block mb-1">🟣 Optom Sotish Narxi</label>
                    <input
                      type="number"
                      min="0"
                      value={modalEditItem.wholesalePrice || 0}
                      onChange={(e) => setModalEditItem({ ...modalEditItem, wholesalePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full bg-stone-900 border border-purple-800/80 text-purple-300 font-bold rounded-xl px-3 py-2 focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-stone-400 font-bold block mb-1">Shtrix-kod</label>
                  <input
                    type="text"
                    value={modalEditItem.barcode || ''}
                    onChange={(e) => setModalEditItem({ ...modalEditItem, barcode: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRowIndex(null);
                    setModalEditItem(null);
                  }}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalRowEdit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Saqlash</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
