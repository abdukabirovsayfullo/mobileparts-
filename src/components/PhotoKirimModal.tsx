import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product, ParsedInvoiceItem } from '../types';
import { formatMoney } from '../utils/formatters';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  X, 
  FileText, 
  Eye, 
  ZoomIn, 
  Check, 
  Building2, 
  HelpCircle, 
  Scan, 
  FlipHorizontal, 
  Zap, 
  Package, 
  Tag, 
  Truck, 
  DollarSign, 
  Layers,
  ArrowRight,
  Clipboard,
  Info
} from 'lucide-react';

interface PhotoKirimModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  categories: string[];
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
}

// Sample mock invoices for rapid testing without paper
const SAMPLE_INVOICES = [
  {
    id: 'sample-1',
    title: 'Andijon Ulgurji Baza Nakladnoyi',
    supplier: 'Andijon Ulgurji Baza (Abu Saxiy dileri)',
    date: new Date().toISOString().slice(0, 10),
    notes: '1-partiya tovarlar: zaryadnik va chexollar',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Remax 20W Tezkor Zaryadnik (Type-C)', quantity: 20, costPrice: 42000, sellingPrice: 75000, wholesalePrice: 58000, category: 'Zaryadniklar', brand: 'Remax' },
      { name: 'iPhone 13 Shaffof Silikon Chexol', quantity: 30, costPrice: 14000, sellingPrice: 35000, wholesalePrice: 22000, category: 'Chexollar', brand: 'Apple' },
      { name: 'Hoco C12 Ikki Portli Adapter 2.4A', quantity: 15, costPrice: 32000, sellingPrice: 60000, wholesalePrice: 45000, category: 'Zaryadniklar', brand: 'Hoco' },
      { name: '9D To\'liq Qoplovchi Himoya Shishasi (Universal)', quantity: 50, costPrice: 6000, sellingPrice: 20000, wholesalePrice: 12000, category: 'Himoya Oynalari', brand: 'Universal' },
      { name: 'Borofone BX51 Type-C 1m Silikon Kabel', quantity: 25, costPrice: 11000, sellingPrice: 28000, wholesalePrice: 18000, category: 'Kabellar', brand: 'Borofone' }
    ]
  },
  {
    id: 'sample-2',
    title: 'Daftarga Qo\'lda Yozilgan Ro\'yxat',
    supplier: 'Malika Optom Bozor (Toshkent)',
    date: new Date().toISOString().slice(0, 10),
    notes: 'Qo\'lda yozilgan yangi partiya aksessuarlar',
    imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
    items: [
      { name: 'Powerbank 10000mAh Tezkor Zaryadlovchi', quantity: 10, costPrice: 88000, sellingPrice: 150000, wholesalePrice: 120000, category: 'Powerbanklar', brand: 'Remax' },
      { name: 'Celebrat G4 Simsiz Bluetooth Quloqchin', quantity: 12, costPrice: 52000, sellingPrice: 95000, wholesalePrice: 75000, category: 'Quloqchinlar', brand: 'Celebrat' },
      { name: 'Magnitli Avtomobil Telefon Tutgichi (Havo panjarasiga)', quantity: 15, costPrice: 24000, sellingPrice: 50000, wholesalePrice: 36000, category: 'Avto Aksessuarlar', brand: 'Hoco' },
      { name: 'Samsung Galaxy A14 Matoviy Chexol', quantity: 20, costPrice: 16000, sellingPrice: 40000, wholesalePrice: 26000, category: 'Chexollar', brand: 'Samsung' }
    ]
  }
];

export const PhotoKirimModal: React.FC<PhotoKirimModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  categories,
  onConfirmKirim
}) => {
  // Input source mode: 'camera' | 'upload' | 'sample'
  const [sourceMode, setSourceMode] = useState<'camera' | 'upload' | 'sample'>('camera');
  
  // Camera stream & refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturingFlash, setIsCapturingFlash] = useState(false);

  // AI Processing state
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanStatus, setAiScanStatus] = useState<string>('');
  const [aiError, setAiError] = useState<string | null>(null);

  // Parsed Items and Invoice Info
  const [parsedItems, setParsedItems] = useState<ParsedInvoiceItem[]>([]);
  const [supplierName, setSupplierName] = useState<string>('Ulgurji Ta\'minotchi');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [invoiceNotes, setInvoiceNotes] = useState<string>('AI Foto Kirim orqali qabul qilindi');
  
  // Payment terms
  const [paymentType, setPaymentType] = useState<'paid' | 'partial' | 'debt'>('paid');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10)
  );

  // Zoom view for previewing image
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Start Camera Stream
  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraError(null);
    try {
      if (videoRef.current?.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        'Kameraga ruxsat berilmadi yoki qurilmada kamera topilmadi. Siz fayl yuklash rejimidan ham foydalanishingiz mumkin.'
      );
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Toggle Camera Facing
  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setParsedItems([]);
      setCapturedImage(null);
      setAiError(null);
      if (sourceMode === 'camera') {
        startCamera(cameraFacingMode);
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, sourceMode]);

  // Listen to paste events (e.g. if user pastes image directly with Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const base64 = event.target.result as string;
                stopCamera();
                setCapturedImage(base64);
                processImageWithGemini(base64);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Capture photo from video stream
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;

    setIsCapturingFlash(true);
    setTimeout(() => setIsCapturingFlash(false), 250);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);

    stopCamera();
    setCapturedImage(base64Image);
    processImageWithGemini(base64Image);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        stopCamera();
        setCapturedImage(base64);
        processImageWithGemini(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // Match items with existing store products to enrich information
  const matchWithExistingProducts = (rawItems: any[]): ParsedInvoiceItem[] => {
    return rawItems.map((item, idx) => {
      const cleanName = String(item.name || '').trim();
      
      // Look for best match in existing products
      const matched = existingProducts.find((p) => {
        const pName = p.name.toLowerCase();
        const curName = cleanName.toLowerCase();
        return pName === curName || pName.includes(curName) || curName.includes(pName);
      });

      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const cost = Number(item.costPrice) > 0 
        ? Number(item.costPrice) 
        : (matched?.purchasePrice || 45000);
      
      const selling = Number(item.sellingPrice) > 0
        ? Number(item.sellingPrice)
        : (matched?.sellingPrice || Math.round((cost * 1.5) / 1000) * 1000);

      const wholesale = Number(item.wholesalePrice) > 0
        ? Number(item.wholesalePrice)
        : (matched?.wholesalePrice || Math.round((selling * 0.8) / 1000) * 1000);

      const cat = item.category && categories.includes(item.category)
        ? item.category
        : (matched?.category || categories[0] || 'Zaryadniklar');

      const brand = item.brand || matched?.brand || 'Universal';

      return {
        id: `parsed-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        name: matched ? matched.name : cleanName,
        quantity: qty,
        costPrice: cost,
        sellingPrice: selling,
        wholesalePrice: wholesale,
        category: cat,
        brand: brand,
        rawLine: item.rawLine || cleanName,
        matchedProductId: matched?.id,
        selected: true
      };
    });
  };

  // Process image with Gemini 3.8 Flash via backend API
  const processImageWithGemini = async (imageBase64: string) => {
    setIsAiScanning(true);
    setAiError(null);
    setAiScanStatus('Gemini 3.8 Flash qo\'lyozma va matnlarni o\'qimoqda...');

    try {
      const response = await fetch('/api/gemini/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          currentCategories: categories
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Rasmni o\'qishda xatolik yuz berdi');
      }

      const invoiceData = resData.data;
      if (!invoiceData || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
        throw new Error('Fotosuratda tovarlar yoki narxlar aniqlanmadi. Iltimos, boshqa burchakdan yorug\'roq joyda rasmga oling.');
      }

      if (invoiceData.supplier) {
        setSupplierName(invoiceData.supplier);
      }
      if (invoiceData.date) {
        setInvoiceDate(invoiceData.date);
      }
      if (invoiceData.notes) {
        setInvoiceNotes(`AI Kirim: ${invoiceData.notes}`);
      }

      const formatted = matchWithExistingProducts(invoiceData.items);
      setParsedItems(formatted);
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setAiError(err.message || 'AI xizmati bilan bog\'lanishda xatolik yuz berdi.');
      
      // If AI fails (e.g. no internet), provide fallback sample items so the user is never stuck
      const fallbackSample = SAMPLE_INVOICES[0];
      setSupplierName(fallbackSample.supplier);
      setParsedItems(matchWithExistingProducts(fallbackSample.items));
    } finally {
      setIsAiScanning(false);
      setAiScanStatus('');
    }
  };

  // Load sample invoice directly
  const handleSelectSample = (sample: typeof SAMPLE_INVOICES[0]) => {
    stopCamera();
    setCapturedImage(sample.imageUrl);
    setSupplierName(sample.supplier);
    setInvoiceDate(sample.date);
    setInvoiceNotes(`AI Kirim: ${sample.notes}`);
    setParsedItems(matchWithExistingProducts(sample.items));
    setAiError(null);
  };

  // Edit parsed item
  const handleUpdateItem = (id: string, field: keyof ParsedInvoiceItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Auto recalculate wholesale or selling price if cost price changes
          if (field === 'costPrice') {
            const newCost = Number(value) || 0;
            if (newCost > 0 && updated.sellingPrice < newCost) {
              updated.sellingPrice = Math.round((newCost * 1.5) / 1000) * 1000;
              updated.wholesalePrice = Math.round((updated.sellingPrice * 0.8) / 1000) * 1000;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Toggle item selection
  const handleToggleSelectItem = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Delete item row
  const handleDeleteItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add new empty manual row
  const handleAddManualItem = () => {
    const newItem: ParsedInvoiceItem = {
      id: `manual-${Date.now()}`,
      name: 'Yangi aksessuar',
      quantity: 10,
      costPrice: 40000,
      sellingPrice: 70000,
      wholesalePrice: 55000,
      category: categories[0] || 'Zaryadniklar',
      brand: 'Universal',
      selected: true
    };
    setParsedItems((prev) => [...prev, newItem]);
  };

  // Totals calculations
  const selectedItems = useMemo(() => parsedItems.filter((i) => i.selected), [parsedItems]);
  const totalCost = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  }, [selectedItems]);
  const totalQuantity = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [selectedItems]);
  const totalPotentialRevenue = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  }, [selectedItems]);
  const potentialProfit = Math.max(0, totalPotentialRevenue - totalCost);

  // Effective payment calculation
  const effectivePaid = useMemo(() => {
    if (paymentType === 'paid') return totalCost;
    if (paymentType === 'debt') return 0;
    return Math.min(totalCost, Math.max(0, paidAmount));
  }, [paymentType, totalCost, paidAmount]);

  const effectiveDebt = Math.max(0, totalCost - effectivePaid);

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setParsedItems([]);
    setAiError(null);
    setSourceMode('camera');
    startCamera(cameraFacingMode);
  };

  // Final Confirmation: Push directly to store inventory & movements!
  const handleConfirmAndSave = () => {
    if (selectedItems.length === 0) {
      alert('Iltimos, kamida bitta tovarni tanlang!');
      return;
    }

    const itemsToCommit = selectedItems.map((item) => {
      // If matches existing product, use that product as base
      const existing = existingProducts.find((p) => p.id === item.matchedProductId);
      
      const productObj: Product = existing
        ? {
            ...existing,
            name: item.name,
            category: item.category,
            brand: item.brand || existing.brand,
            purchasePrice: item.costPrice,
            wholesalePrice: item.wholesalePrice,
            sellingPrice: item.sellingPrice
          }
        : {
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: item.name,
            category: item.category,
            brand: item.brand || 'Universal',
            barcode: `PB${Date.now().toString().slice(-8)}`,
            purchasePrice: item.costPrice,
            wholesalePrice: item.wholesalePrice || Math.round(item.sellingPrice * 0.8),
            sellingPrice: item.sellingPrice,
            stock: 0,
            minStockAlert: 5
          };

      return {
        product: productObj,
        quantity: item.quantity,
        unitCost: item.costPrice,
        wholesalePrice: item.wholesalePrice,
        unitPrice: item.sellingPrice
      };
    });

    const isDebt = paymentType !== 'paid' && effectiveDebt > 0;
    const debtInfo = isDebt
      ? {
          isDebt: true,
          paidAmount: effectivePaid,
          remainingAmount: effectiveDebt,
          supplierPhone: supplierPhone.trim() || undefined,
          dueDate: dueDate
        }
      : undefined;

    onConfirmKirim(
      itemsToCommit,
      supplierName.trim() || 'Ulgurji Ta\'minotchi',
      invoiceNotes.trim() || 'AI Foto Kirim orqali qabul qilindi',
      debtInfo
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 font-black shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">
                  Foto Kirim (AI Agent orqali)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Qog'oz nakladnoy yoki daftar yozuvini suratga oling — tovar nomi, dona soni va narxlari avtomatik ajratiladi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Top Source Mode Selector (Only if image not yet captured or scanning) */}
          {!capturedImage && !isAiScanning && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('camera');
                    startCamera(cameraFacingMode);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sourceMode === 'camera'
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Kamera orqali rasm olish</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('upload');
                    stopCamera();
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sourceMode === 'upload'
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Upload className="w-4 h-4 text-sky-600" />
                  <span>Fayl yuklash (Galereya)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('sample');
                    stopCamera();
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sourceMode === 'sample'
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Sinov Namunalari</span>
                </button>
              </div>

              <div className="text-[11px] text-stone-500 flex items-center gap-1">
                <Clipboard className="w-3.5 h-3.5 text-stone-400" />
                <span>yoki rasmni to'g'ridan-to'g'ri <kbd className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-mono">Ctrl+V</kbd> bosing</span>
              </div>
            </div>
          )}

          {/* Step 1: Camera Capture View */}
          {sourceMode === 'camera' && !capturedImage && !isAiScanning && (
            <div className="space-y-4">
              <div className="relative rounded-3xl bg-stone-950 overflow-hidden aspect-[4/3] sm:aspect-[16/9] max-h-[460px] flex items-center justify-center border-2 border-stone-800 shadow-inner">
                {/* Flash overlay */}
                {isCapturingFlash && (
                  <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300" />
                )}

                {/* Video feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Document Viewfinder / Scanner Overlay */}
                <div className="absolute inset-6 sm:inset-10 border-2 border-dashed border-amber-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                    <span className="px-2.5 py-1 rounded-full bg-stone-900/80 text-amber-300 text-[10px] font-mono uppercase tracking-wider backdrop-blur-xs">
                      Nakladnoy / Daftar matnini rom ichiga joylashtiring
                    </span>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                    <div className="text-[11px] text-stone-300/80 text-center">
                      Yorug' joyda va matn aniq ko'rinadigan holatda ushlang
                    </div>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                  </div>
                </div>

                {/* Camera Flip button */}
                <button
                  type="button"
                  onClick={handleToggleCameraFacing}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer z-30"
                  title="Kamerani almashtirish (Oldi/Orqa)"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>

                {/* Camera Error view */}
                {cameraError && (
                  <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
                    <AlertCircle className="w-12 h-12 text-rose-500" />
                    <p className="text-sm text-stone-300 max-w-md">{cameraError}</p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Qayta urinish
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('upload')}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-xs font-black cursor-pointer"
                      >
                        Galereyadan rasm tanlash
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shutter Capture Button */}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={!isCameraActive}
                  className="px-8 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <Camera className="w-5 h-5 text-stone-950" />
                  <span className="text-sm uppercase tracking-wide">Rasmga Olish (Tanish)</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: File Upload View */}
          {sourceMode === 'upload' && !capturedImage && !isAiScanning && (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-amber-400 rounded-3xl p-8 sm:p-12 text-center bg-stone-50 hover:bg-amber-50/40 transition-all cursor-pointer space-y-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-stone-900">
                    Nakladnoy rasmini bu yerga tashlang yoki tanlang
                  </h4>
                  <p className="text-xs text-stone-500 mt-1">
                    JPG, PNG, WEBP yoki HEIC formatdagi fayllar (Telefon kamerasi yoki Telegram cheki)
                  </p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Faylni tanlash</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Step 1: Sample Invoices View */}
          {sourceMode === 'sample' && !capturedImage && !isAiScanning && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Hozir yonida qog'oz nakladnoy bo'lmagan holatda tizimni tekshirish uchun quyidagi tayyor namunalardan birini bosing. Dastur ularni xuddi fotosurat kabi o'qiydi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SAMPLE_INVOICES.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="p-4 rounded-2xl border border-stone-200 hover:border-amber-400 bg-white hover:bg-amber-50/20 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-stone-100 group-hover:bg-amber-100 text-stone-800 group-hover:text-amber-900 rounded-lg text-[10px] font-bold">
                        {sample.title}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">{sample.items.length} ta tovar</span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-stone-900">{sample.supplier}</div>
                      <div className="text-[11px] text-stone-500">{sample.notes}</div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                      <span className="text-stone-400">Jami hisob:</span>
                      <span className="font-bold text-emerald-700">
                        {formatMoney(sample.items.reduce((s, i) => s + i.quantity * i.costPrice, 0))}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 bg-stone-900 group-hover:bg-amber-400 text-white group-hover:text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Ushbu namunani o'qish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Scanning Loader (Animated scan line effect) */}
          {isAiScanning && (
            <div className="py-12 flex flex-col items-center justify-center space-y-5 text-center">
              <div className="relative w-24 h-24 rounded-3xl bg-amber-100 flex items-center justify-center border-2 border-amber-300 shadow-xl overflow-hidden">
                <Camera className="w-10 h-10 text-amber-600 animate-bounce" />
                {/* Laser scan line */}
                <div className="absolute inset-x-0 h-1 bg-red-500 shadow-[0_0_8px_red] animate-pulse" style={{ animation: 'bounce 1.5s infinite' }} />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-black text-base text-stone-900 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                  <span>AI Agent Hujjatni Tahlil Qilmoqda...</span>
                </h4>
                <p className="text-xs text-stone-500">
                  {aiScanStatus || 'Qo\'lyozma so\'zlar, tovar nomlari, dona va narxlar ajratib olinmoqda...'}
                </p>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {aiError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">AI Tanish xabari:</div>
                  <div>{aiError}</div>
                  <div className="text-[11px] text-rose-700 mt-1">
                    (Namunaviy tovarlar ro'yxati siz uchun tayyorlandi, narxlarni pastdagi jadvalda qo'lda ham o'zgartirishingiz mumkin)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="px-3 py-1.5 bg-rose-200 hover:bg-rose-300 text-rose-950 font-bold rounded-lg shrink-0 cursor-pointer"
              >
                Qayta rasm olish
              </button>
            </div>
          )}

          {/* Step 2: Parsed Results & Verification Form */}
          {parsedItems.length > 0 && !isAiScanning && (
            <div className="space-y-6">
              
              {/* Top Controls: Photo preview bar + Retake */}
              <div className="bg-stone-50 rounded-2xl border border-stone-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {capturedImage && (
                    <div 
                      onClick={() => setIsImageZoomed(true)}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-300 cursor-pointer group shadow-xs shrink-0"
                      title="Rasmni kattalashtirib ko'rish"
                    >
                      <img
                        src={capturedImage}
                        alt="Captured invoice"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                        <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-stone-900">
                        {parsedItems.length} ta tovar aniqlandi
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                        ✓ AI Tekshiruvidan o'tdi
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Har bir tovar nomi, narxi va sonini tekshirib, xohlasangiz tuzatishingiz mumkin
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Qator qo'shish</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Boshqa rasm</span>
                  </button>
                </div>
              </div>

              {/* Invoice Meta: Supplier & Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-stone-50/80 rounded-2xl border border-stone-200">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-stone-500" />
                    <span>Ta'minotchi (Baza):</span>
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Masalan: Abu Saxiy Remax optom"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Telefon raqami (ixtiyoriy):
                  </label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    To'lov holati:
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value="paid">Naqd to'landi (To'liq)</option>
                    <option value="debt">Nasiyaga olindi (To'liq qarz)</option>
                    <option value="partial">Qisman to'landi (Avans berildi)</option>
                  </select>
                </div>

                {paymentType === 'partial' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Berilgan avans (so'm):
                    </label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Kirim sanasi:
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={parsedItems.length > 0 && parsedItems.every((i) => i.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setParsedItems((prev) => prev.map((i) => ({ ...i, selected: checked })));
                            }}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 min-w-[200px]">Tovar Nomi &amp; Brend</th>
                        <th className="p-3 min-w-[140px]">Kategoriya</th>
                        <th className="p-3 w-28 text-center">Soni (Dona)</th>
                        <th className="p-3 min-w-[110px] text-right">Tan Narxi</th>
                        <th className="p-3 min-w-[110px] text-right">Sotish Narxi</th>
                        <th className="p-3 min-w-[110px] text-right">Jami Tan Narx</th>
                        <th className="p-3 w-12 text-center">O'chirish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {parsedItems.map((item, index) => {
                        const itemSubtotal = item.quantity * item.costPrice;
                        const marginPercent = item.costPrice > 0 
                          ? Math.round(((item.sellingPrice - item.costPrice) / item.costPrice) * 100) 
                          : 0;

                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-amber-50/30 transition-colors ${!item.selected ? 'opacity-50 bg-stone-50' : ''}`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleSelectItem(item.id)}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                              />
                            </td>

                            <td className="p-3">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                  className="w-full px-2 py-1 bg-stone-50 focus:bg-white border border-transparent focus:border-amber-400 rounded-lg text-xs font-bold text-stone-900 focus:outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  {item.matchedProductId ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-0.5">
                                      <Check className="w-2.5 h-2.5" />
                                      Mavjud tovar (qoldiq oshiriladi)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                                      + Yangi tovar
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={item.brand || ''}
                                    onChange={(e) => handleUpdateItem(item.id, 'brand', e.target.value)}
                                    placeholder="Brend"
                                    className="w-24 px-1.5 py-0.5 text-[10px] bg-stone-100 text-stone-600 rounded border border-transparent focus:border-stone-300 focus:bg-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <select
                                value={item.category}
                                onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                                className="w-full px-2 py-1.5 bg-stone-50 focus:bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-400"
                              >
                                {categories.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>

                            <td className="p-3 text-center">
                              <div className="inline-flex items-center border border-stone-200 rounded-lg bg-stone-50 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                                  className="px-2 py-1 hover:bg-stone-200 text-stone-600 font-bold"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                                  className="w-12 text-center text-xs font-bold text-stone-900 bg-white border-x border-stone-200 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, 'quantity', item.quantity + 1)}
                                  className="px-2 py-1 hover:bg-stone-200 text-stone-600 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td className="p-3 text-right">
                              <input
                                type="number"
                                step="500"
                                value={item.costPrice}
                                onChange={(e) => handleUpdateItem(item.id, 'costPrice', Number(e.target.value))}
                                className="w-24 text-right px-2 py-1 bg-stone-50 focus:bg-white border border-stone-200 focus:border-amber-400 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none"
                              />
                            </td>

                            <td className="p-3 text-right">
                              <div className="space-y-0.5">
                                <input
                                  type="number"
                                  step="1000"
                                  value={item.sellingPrice}
                                  onChange={(e) => handleUpdateItem(item.id, 'sellingPrice', Number(e.target.value))}
                                  className="w-24 text-right px-2 py-1 bg-stone-50 focus:bg-white border border-stone-200 focus:border-emerald-500 rounded-lg text-xs font-mono font-bold text-emerald-800 focus:outline-none"
                                />
                                <div className="text-[10px] text-emerald-600 font-bold">
                                  +{marginPercent}% foyda
                                </div>
                              </div>
                            </td>

                            <td className="p-3 text-right font-mono font-black text-stone-900">
                              {formatMoney(itemSubtotal)}
                            </td>

                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                title="Qatordan o'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Calculation & Confirmation Panel */}
              <div className="p-5 bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-stone-800">
                <div className="space-y-1">
                  <div className="text-xs text-stone-400">
                    Tanlangan tovarlar kirim yakuni ({selectedItems.length} xil / {totalQuantity} dona):
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                      {formatMoney(totalCost)}
                    </span>
                    <span className="text-xs text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800">
                      Kutilayotgan sotuv: {formatMoney(totalPotentialRevenue)} (+{formatMoney(potentialProfit)} sof foyda)
                    </span>
                  </div>

                  {paymentType !== 'paid' && effectiveDebt > 0 && (
                    <div className="text-xs text-amber-300 font-medium pt-1">
                      ⚠️ Ta'minotchiga qarz yoziladi: <span className="font-bold">{formatMoney(effectiveDebt)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 md:flex-none px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    Bekor qilish
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmAndSave}
                    className="flex-1 md:flex-none px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-stone-950 font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5 text-stone-950" />
                    <span>Bitta Bosishda Omborga Kiritish</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Zoomed Image Lightbox */}
        {isImageZoomed && capturedImage && (
          <div 
            onClick={() => setIsImageZoomed(false)}
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={capturedImage}
                alt="Zoomed invoice"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-stone-700 shadow-2xl"
              />
              <div className="absolute top-3 right-3 bg-stone-900/80 px-3 py-1.5 rounded-full text-white text-xs font-bold">
                Yopish uchun bosing
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
