import React, { useState } from 'react';
import { SaleReceiptData, StoreSettings } from '../types';
import { STORE_INFO } from '../data/initialData';
import { formatMoney, formatDate } from '../utils/formatters';
import { generateReceiptPdf, generateThermalReceiptPdf, triggerPdfDownload, openPdfInNewTab } from '../utils/pdfGenerator';
import { 
  Printer, 
  X, 
  Copy, 
  Check, 
  MapPin, 
  User, 
  Phone, 
  Receipt, 
  FileText,
  Building2,
  Calendar,
  Share2,
  Eye,
  EyeOff,
  Download,
  ExternalLink,
  CheckSquare
} from 'lucide-react';

interface PrintReceiptModalProps {
  receipt: SaleReceiptData | null;
  storeInfo?: StoreSettings;
  showPrices?: boolean;
  onToggleShowPrices?: (showPrices: boolean) => void;
  onClose: () => void;
  autoPrint?: boolean;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  receipt,
  storeInfo = STORE_INFO,
  showPrices: initialShowPrices,
  onToggleShowPrices,
  onClose,
  autoPrint = false
}) => {
  const [printFormat, setPrintFormat] = useState<'pos' | 'invoice'>('pos');
  const [showPrices, setShowPrices] = useState<boolean>(
    initialShowPrices !== undefined ? initialShowPrices : (receipt?.showPrices !== undefined ? receipt.showPrices : true)
  );
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);


  const [printError, setPrintError] = useState('');
  const autoSavedReceipt = React.useRef<SaleReceiptData | null>(null);

  const handleDownloadPdf = React.useCallback(() => {
    if (!receipt) return false;
    setDownloadingPdf(true);
    setPrintError('');
    try {
      const doc = (printFormat === 'pos' ? generateThermalReceiptPdf : generateReceiptPdf)({
        receipt, storeInfo: storeInfo || STORE_INFO, showPrices
      });
      const prefix = printFormat === 'pos' ? 'Chek-80mm' : 'Nakladnoy-A4';
      const cleanNum = receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!triggerPdfDownload(doc, `${prefix}_${cleanNum}.pdf`)) {
        throw new Error('PDF download failed');
      }
      return true;
    } catch (error) {
      console.error('[PDF] Receipt download failed:', error);
      setPrintError("PDF saqlanmadi. PDF tugmasini qayta bosing va brauzer yuklab olish ruxsatini tekshiring.");
      return false;
    } finally {
      setDownloadingPdf(false);
    }
  }, [receipt, storeInfo, showPrices, printFormat]);

  // Save once when a receipt opens, including automatic Telegram receipts.
  // Recording success inside the timer avoids duplicate downloads in StrictMode.
  React.useEffect(() => {
    if (!receipt || autoSavedReceipt.current === receipt) return;
    const timer = window.setTimeout(() => {
      if (handleDownloadPdf()) autoSavedReceipt.current = receipt;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [receipt, handleDownloadPdf]);

  const handlePrint = handleDownloadPdf;

  if (!receipt) return null;

  const currentStore = storeInfo || STORE_INFO;
  const totalUnits = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleTogglePrices = () => {
    const next = !showPrices;
    setShowPrices(next);
    onToggleShowPrices?.(next);
  };

  const handleOpenInNewTab = () => {
    try {
      const doc = (printFormat === 'pos' ? generateThermalReceiptPdf : generateReceiptPdf)({
        receipt, storeInfo: currentStore, showPrices
      });
      openPdfInNewTab(doc);
    } catch (error) {
      console.error('[PDF] Preview failed:', error);
      setPrintError("PDF ochilmadi. PDF yuklab olish tugmasidan foydalaning.");
    }
  };

  const handleCopyText = () => {
    const isReturn = receipt.isReturn;

    if (!showPrices) {
      // PRICE-FREE ORDER LIST (Aligned with user's requirement for sharing order lists)
      const textLines = [
        `📦 BUYURTMA RO'YXATI (ORDER LIST)`,
        `📱 ${currentStore.name}`,
        `📍 ${currentStore.address}`,
        `📞 Tel: ${currentStore.phone}`,
        `---------------------------------`,
        `№ ${receipt.receiptNumber}`,
        `📅 Sana: ${formatDate(receipt.date)}`,
        `👤 Xaridor / Kimga: ${receipt.customerName}`,
        receipt.customerPhone ? `📞 Tel: ${receipt.customerPhone}` : '',
        receipt.customerAddress ? `📍 Manzil: ${receipt.customerAddress}` : '',
        `---------------------------------`,
        `TOVARLAR RO'YXATI (NARXLARSIZ):`,
        ...receipt.items.map(
          (it, idx) =>
            `${idx + 1}. ${it.name}${it.category ? ` [${it.category}]` : ''} — ${it.quantity} dona`
        ),
        `---------------------------------`,
        `Jami: ${receipt.items.length} xil tovar, ${totalUnits} dona`,
        `---------------------------------`,
        `* Buyurtma ro'yxati (Ta'minotchi / mijoz uchun narxlarsiz nusxa) *`
      ]
        .filter(Boolean)
        .join('\n');

      navigator.clipboard.writeText(textLines).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }

    // FULL RECEIPT WITH PRICES
    const textLines = [
      `📱 ${currentStore.name}`,
      `📍 ${currentStore.address}`,
      `📞 Tel: ${currentStore.phone}`,
      `---------------------------------`,
      isReturn ? `↩️ VAZVRAT CHEKI №: ${receipt.receiptNumber}` : `🧾 Chek №: ${receipt.receiptNumber}`,
      `📅 Sana: ${formatDate(receipt.date)}`,
      `👤 Mijoz: ${receipt.customerName}`,
      receipt.customerPhone ? `📞 Tel: ${receipt.customerPhone}` : '',
      receipt.customerAddress ? `📍 Manzil: ${receipt.customerAddress}` : '',
      receipt.returnReason ? `⚠️ Sabab: ${receipt.returnReason}` : '',
      `---------------------------------`,
      isReturn ? `QAYTARILGAN TOVARLAR:` : `TOVARLAR:`,
      ...receipt.items.map(
        (it, idx) =>
          `${idx + 1}. ${it.name}${it.category ? ` [${it.category}]` : ''} - ${it.quantity} dona x ${formatMoney(it.unitPrice)} = ${formatMoney(it.total)}`
      ),
      `---------------------------------`,
      isReturn ? `💰 MIJOZGA TO'LANDI: ${formatMoney(receipt.total)}` : `💰 JAMI: ${formatMoney(receipt.total)}`,
      `To'lov turi: ${receipt.paymentMethod.toUpperCase()}`,
      receipt.isDebt
        ? `⚠️ Nasiya qoldig'i: ${formatMoney(receipt.debtRemaining || 0)} (Muddati: ${receipt.debtDueDate || '-'})`
        : '',
      `---------------------------------`,
      isReturn ? `Tovar muvaffaqiyatli qabul qilindi.` : `Xaridingiz uchun rahmat!`
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(textLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const paymentMethodLabel = {
    naqd: 'Naqd Pul',
    click_payme: 'Click / Payme',
    uzum: 'Uzum Bank',
    nasiya: 'Nasiya (Qarzga)'
  }[receipt.paymentMethod];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print px-5 py-3.5 bg-stone-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${showPrices ? 'bg-amber-400 text-stone-950' : 'bg-emerald-500 text-white'}`}>
              {showPrices ? <Printer className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-black text-sm flex items-center gap-2">
                <span>{showPrices ? 'Chiqim Cheki & Nakladnoy' : "Buyurtma Ro'yxati (Narxlarsiz)"}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  showPrices 
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }`}>
                  {showPrices ? 'Narxlar Faol' : 'Order List (Narxlarsiz)'}
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                № {receipt.receiptNumber} • Kimga: {receipt.customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="bg-stone-900 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintFormat('pos')}
                className={`px-3 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                  printFormat === 'pos'
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Xprinter XP-80 (80 mm)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('invoice')}
                className={`px-3 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                  printFormat === 'invoice'
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Nakladnoy (A4)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar & Price View Switcher */}
        <div className="no-print px-5 py-2.5 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* PRICE VIEW TOGGLE (Core User Requirement) */}
            <button
              type="button"
              onClick={handleTogglePrices}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                showPrices
                  ? 'bg-stone-900 border-stone-800 text-amber-300 hover:bg-stone-800'
                  : 'bg-emerald-700 hover:bg-emerald-800 border-emerald-800 text-white shadow-emerald-700/20'
              }`}
              title={showPrices ? "Narxlarsiz rejimga o'tish: Tovar nomi, toifasi va soni qoladi (Ta'minotchi / Buyurtma ro'yxati uchun)" : "Narxlarni ko'rsatish (To'liq xarid cheki)"}
            >
              {showPrices ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Narxlar: Ko'rinsin</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Narxlarsiz (Faqat tovar & soni)</span>
                </>
              )}
            </button>

            {/* Direct Vector PDF Download */}
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title={printFormat === 'pos' ? "80 mm chek PDF faylini saqlash" : "A4 nakladnoy PDF faylini saqlash"}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Yuklanmoqda...' : 'PDF Yuklab Olish'}</span>
            </button>

            {/* Open in New Tab */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer hidden sm:flex"
              title="PDF faylni to'liq ekran yangi oynada ochish"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
              <span>Yangi Oynada</span>
            </button>

            {/* Print directly via browser / thermal printer */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF saqlash (Printer uchun)</span>
            </button>

            {/* Copy order list as text for Telegram / WhatsApp */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Telegram yoki WhatsApp orqali jo'natish uchun matnni nusxalash"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Nusxalandi!' : 'Matn'}</span>
            </button>
          </div>

          <div className="text-[11px] text-stone-500 font-medium hidden md:block">
            {!showPrices ? "Ta'minotchi rejimi (Narxlarsiz tovar ro'yxati)" : "Kassa rejimi (To'liq hisob-kitob)"}
          </div>
        </div>

        {printFormat === 'pos' && (
          <div className="no-print px-5 py-2 bg-amber-50 text-xs text-stone-800">
            Chek ochilganda 80 mm PDF avtomatik yuklab olinadi. PDF faylini ochib XP-80 printerini va 100% masshtabni tanlang.
            Brauzerda “Har bir faylni saqlash joyini so'rash” yoqilgan bo'lsa, saqlash oynasi chiqadi.
          </div>
        )}
        {printError && <div role="alert" className="no-print px-5 py-2 text-sm text-red-700">{printError}</div>}

        {/* Printable View Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-200 flex justify-center">
          {/* FORMAT 1: Kassa Cheki (Thermal 80mm style) */}
          {printFormat === 'pos' && (
            <div
              id="printable-receipt"
              className="bg-white text-stone-900 p-6 rounded-2xl shadow-md max-w-sm w-full font-mono text-xs border border-stone-300 print:shadow-none print:border-none print:p-2"
            >
              {/* Header */}
              <div className="text-center pb-3 border-b-2 border-dashed border-stone-400 space-y-1">
                {receipt.isReturn ? (
                  <div className="inline-block px-2.5 py-0.5 bg-rose-600 text-white font-black text-xs rounded mb-1 tracking-wider">
                    ↩️ TOVAR QAYTARISH (VAZVRAT)
                  </div>
                ) : !showPrices ? (
                  <div className="inline-block px-2.5 py-0.5 bg-emerald-700 text-white font-black text-xs rounded mb-1 tracking-wider">
                    📦 BUYURTMA RO'YXATI (ORDER LIST)
                  </div>
                ) : (
                  <div className="inline-block px-2.5 py-0.5 bg-stone-950 text-amber-400 font-black text-xs rounded mb-1 tracking-wider">
                    MOBILE PARTS
                  </div>
                )}
                <h2 className="font-black text-sm uppercase tracking-tight text-stone-950">
                  {currentStore.name}
                </h2>
                <p className="text-[10px] text-stone-600 leading-tight">
                  {currentStore.address}
                </p>
                <p className="text-[10px] font-bold text-stone-800">
                  Tel: {currentStore.phone}
                </p>
                {!showPrices && (
                  <div className="text-[9px] font-bold text-emerald-800 bg-emerald-50 py-0.5 px-1 rounded">
                    * Narxlarsiz Buyurtma Varaqasi *
                  </div>
                )}
              </div>

              {/* Receipt Meta & Customer / Location Info */}
              <div className="py-3 border-b-2 border-dashed border-stone-400 space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>{receipt.isReturn ? 'VAZVRAT №:' : !showPrices ? 'BUYURTMA №:' : 'CHEK №:'}</span>
                  <span className="font-black text-stone-950">{receipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>SANA VA VAQT:</span>
                  <span>{formatDate(receipt.date)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>MAS'UL XODIM:</span>
                  <span>{receipt.cashierName || currentStore.accountantName}</span>
                </div>

                {/* Targeted Customer Details */}
                <div className="pt-2 mt-2 border-t border-stone-200 space-y-1">
                  <div className="flex items-start justify-between font-bold">
                    <span className="text-stone-500">{receipt.isReturn ? 'MIJOZ:' : 'KIMGA:'}</span>
                    <span className="text-right text-stone-950 font-black">
                      {receipt.customerName}
                    </span>
                  </div>

                  {receipt.customerPhone && (
                    <div className="flex justify-between text-stone-600">
                      <span className="text-stone-500">TEL:</span>
                      <span className="font-medium">{receipt.customerPhone}</span>
                    </div>
                  )}

                  {receipt.returnReason && (
                    <div className="flex items-start justify-between font-bold bg-rose-50 p-1.5 rounded border border-rose-200 text-rose-900">
                      <span>SABAB:</span>
                      <span className="text-right font-black">{receipt.returnReason}</span>
                    </div>
                  )}

                  {!receipt.isReturn && (
                    <div className="flex items-start justify-between font-bold bg-amber-50 p-1.5 rounded border border-amber-200">
                      <span className="text-amber-800">QAYERGA:</span>
                      <span className="text-right text-stone-950 font-black">
                        {receipt.customerAddress || "Do'kondan olib ketildi (Paxtaobod)"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="py-3 border-b-2 border-dashed border-stone-400 space-y-2">
                <div className="font-bold text-[10px] text-stone-500 uppercase flex justify-between pb-1 border-b border-stone-200">
                  <span>{showPrices ? (receipt.isReturn ? 'Qaytarilgan Tovar' : 'Nomi / Soni / Narxi') : 'Tovar Nomi & Toifasi'}</span>
                  <span>{showPrices ? 'Jami' : 'Miqdori'}</span>
                </div>

                {receipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-stone-950 text-[11px] leading-tight flex items-start justify-between gap-1">
                      <span>{idx + 1}. {item.name}</span>
                      {!showPrices && (
                        <span className="font-black text-emerald-800 whitespace-nowrap">
                          {item.quantity} dona
                        </span>
                      )}
                    </div>
                    {item.category && (
                      <div className="text-[10px] text-stone-500">
                        Toifasi: <span className="font-medium text-stone-700">{item.category}</span>
                      </div>
                    )}
                    {showPrices && (
                      <div className="flex justify-between text-stone-600 text-[10px]">
                        <span>
                          {item.quantity} dona x {formatMoney(item.unitPrice)}
                        </span>
                        <span className="font-black text-stone-950">
                          {formatMoney(item.total)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals & Payments Section */}
              {showPrices ? (
                <div className="py-3 border-b-2 border-dashed border-stone-400 space-y-1.5">
                  {receipt.subtotal && receipt.subtotal > receipt.total && (
                    <>
                      <div className="flex justify-between text-stone-600 text-[11px]">
                        <span>Mahsulotlar qiymati:</span>
                        <span>{formatMoney(receipt.subtotal)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-700 text-[11px]">
                        <span>Chegirma (Skitka):</span>
                        <span>-{formatMoney(receipt.subtotal - receipt.total)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between font-black text-sm text-stone-950 pt-1">
                    <span>{receipt.isReturn ? "MIJOZGA TO'LANDI:" : "JAMI TO'LOV:"}</span>
                    <span className={receipt.isReturn ? 'text-rose-600' : ''}>{formatMoney(receipt.total)}</span>
                  </div>

                  <div className="flex justify-between text-stone-700 font-bold text-[11px]">
                    <span>{receipt.isReturn ? "TO'LOV QAYTARILDI:" : "TO'LOV USULI:"}</span>
                    <span className="uppercase">{paymentMethodLabel}</span>
                  </div>

                  {receipt.paidAmount !== undefined && receipt.paidAmount > 0 && !receipt.isReturn && (
                    <div className="flex justify-between text-stone-600 text-[11px]">
                      <span>Berilgan pul:</span>
                      <span>{formatMoney(receipt.paidAmount)}</span>
                    </div>
                  )}

                  {receipt.changeAmount !== undefined && receipt.changeAmount > 0 && !receipt.isReturn && (
                    <div className="flex justify-between font-bold text-stone-900 text-[11px]">
                      <span>Qaytim (sdacha):</span>
                      <span>{formatMoney(receipt.changeAmount)}</span>
                    </div>
                  )}

                  {receipt.isDebt && (
                    <div className="pt-2 mt-1 border-t border-red-200 bg-red-50 p-2 rounded text-red-900 space-y-0.5 text-[11px]">
                      <div className="flex justify-between font-bold">
                        <span>Nasiya Qarz:</span>
                        <span className="font-black text-red-700">{formatMoney(receipt.debtRemaining || 0)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-red-800">
                        <span>Qaytarish muddati:</span>
                        <span className="font-bold">{receipt.debtDueDate || '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* STRICTLY NO PRICES SUMMARY FOR ORDER LIST */
                <div className="py-3 border-b-2 border-dashed border-stone-400 space-y-1.5">
                  <div className="flex justify-between font-bold text-stone-700 text-xs">
                    <span>Jami tovar turlari:</span>
                    <span className="font-black text-stone-950">{receipt.items.length} xil</span>
                  </div>
                  <div className="flex justify-between font-black text-emerald-800 text-sm">
                    <span>Umumiy buyurtma miqdori:</span>
                    <span>{totalUnits} dona</span>
                  </div>
                  <div className="text-[10px] text-stone-500 pt-1 italic">
                    * Narxlarsiz buyurtma ro'yxati (Ta'minotchi / mijoz bilan bo'lishish uchun).
                  </div>
                </div>
              )}

              {/* Footer text */}
              <div className="pt-4 text-center space-y-1.5 text-[10px] text-stone-600">
                <p className="font-bold text-stone-900">
                  {showPrices 
                    ? (receipt.isReturn ? 'Tovar muvaffaqiyatli qabul qilindi' : 'Xaridingiz uchun tashakkur!') 
                    : "Buyurtma ro'yxati muvaffaqiyatli shakllantirildi"}
                </p>
                <p className="text-[9px]">
                  {showPrices
                    ? (receipt.isReturn 
                      ? "Qaytarilgan tovar omborga kirim qilindi va to'lov hisob-kitob qilindi." 
                      : 'Mahsulot nuqsoni aniqlansa 3 kun ichida chek bilan murojaat qiling.')
                    : "Iltimos tovarlarni qabul qilishda soni va toifasini tekshiring."}
                </p>
                <div className="pt-2 text-center text-stone-400 font-mono tracking-widest text-[9px]">
                  * * * BEELINE PAXTAOBOD * * *
                </div>
              </div>
            </div>
          )}

          {/* FORMAT 2: Rasmiy Tovar Nakladnoyi / Faktura / Order List (A4 / A5) */}
          {printFormat === 'invoice' && (
            <div
              id="printable-receipt"
              className="bg-white text-stone-900 p-8 rounded-2xl shadow-md max-w-xl w-full text-xs border border-stone-300 font-sans print:shadow-none print:border-none print:p-2"
            >
              {/* Document Header */}
              <div className="flex items-start justify-between border-b-2 border-stone-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-400 text-stone-950 font-black rounded text-[11px]">
                      MOBILE PARTS
                    </span>
                    <span className="font-black text-base uppercase text-stone-950">
                      {currentStore.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1">
                    {currentStore.address}
                  </p>
                  <p className="text-[11px] text-stone-600">
                    Aloqa telefoni: <strong className="text-stone-900">{currentStore.phone}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <div className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${
                    !showPrices 
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : receipt.isReturn 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-stone-100 text-stone-900'
                  }`}>
                    {!showPrices ? "BUYURTMA RO'YXATI (ORDER LIST)" : receipt.isReturn ? 'VAZVRAT DALOLATNOMASI' : 'TOVAR NAKLADNOYI'}
                  </div>
                  <div className="font-mono text-sm font-black text-stone-900 mt-1">
                    № {receipt.receiptNumber}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {formatDate(receipt.date)}
                  </div>
                </div>
              </div>

              {/* Counterparties: Kimdan va Kimga/Qayerga */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-stone-200">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-stone-500" />
                    <span>Yetkazib Beruvchi (Do'kon):</span>
                  </div>
                  <div className="font-black text-stone-950 text-xs">
                    {currentStore.name}
                  </div>
                  <div className="text-[11px] text-stone-600">
                    Mas'ul: {receipt.cashierName || currentStore.accountantName}
                  </div>
                  <div className="text-[11px] text-stone-600">
                    Tel: {currentStore.phone}
                  </div>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-1">
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-amber-600" />
                    <span>Qabul Qiluvchi (Mijoz / Buyurtmachi):</span>
                  </div>
                  <div className="font-black text-stone-950 text-xs">
                    {receipt.customerName}
                  </div>
                  {receipt.customerPhone && (
                    <div className="text-[11px] text-stone-700 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>{receipt.customerPhone}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-stone-900 font-bold flex items-start gap-1 pt-0.5">
                    <MapPin className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                    <span>Qayerga: {receipt.customerAddress || "Do'kondan olib ketildi (Paxtaobod)"}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 font-bold border-y border-stone-300 text-[11px]">
                      <th className="py-2 px-2 text-center w-8">№</th>
                      <th className="py-2 px-2">Tovar nomi va modeli</th>
                      <th className="py-2 px-2">Toifasi</th>
                      <th className="py-2 px-2 text-center w-20">Miqdori</th>
                      {showPrices ? (
                        <>
                          <th className="py-2 px-2 text-right w-24">Narxi</th>
                          <th className="py-2 px-2 text-right w-28">Jami Summa</th>
                        </>
                      ) : (
                        <th className="py-2 px-2 text-center w-20">Qabul [ ✓ ]</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-xs">
                    {receipt.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-2 text-center text-stone-500 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-stone-900">
                          {it.name}
                        </td>
                        <td className="py-2.5 px-2 text-stone-600">
                          {it.category || 'Aksessuar'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-stone-900">
                          {it.quantity} dona
                        </td>
                        {showPrices ? (
                          <>
                            <td className="py-2.5 px-2 text-right text-stone-700">
                              {formatMoney(it.unitPrice)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-stone-950">
                              {formatMoney(it.total)}
                            </td>
                          </>
                        ) : (
                          <td className="py-2.5 px-2 text-center font-mono text-stone-400">
                            [ &nbsp; ]
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Footer */}
                  <tfoot>
                    <tr className="border-t-2 border-stone-300 font-bold bg-stone-50 text-[11px]">
                      <td colSpan={3} className="py-2.5 px-2 text-stone-700">
                        Jami: {receipt.items.length} xil tovar
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-stone-950">
                        {totalUnits} dona
                      </td>
                      {showPrices ? (
                        <>
                          <td className="py-2.5 px-2 text-right text-stone-500">Jami:</td>
                          <td className="py-2.5 px-2 text-right font-black text-stone-950 text-sm">
                            {formatMoney(receipt.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 px-2 text-center text-[10px] text-emerald-700">
                          Narxlarsiz
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Total Calculation & Payment Method (Only when showPrices is true) */}
              {showPrices ? (
                <div className="border-t-2 border-stone-900 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-stone-700">
                      To'lov usuli:{' '}
                      <strong className="text-stone-950 uppercase">{paymentMethodLabel}</strong>
                    </div>
                    {receipt.isDebt && (
                      <div className="text-xs font-bold text-red-600">
                        Nasiya qoldig'i: {formatMoney(receipt.debtRemaining || 0)} (Muddati: {receipt.debtDueDate || '-'})
                      </div>
                    )}
                    {receipt.notes && (
                      <div className="text-[11px] text-stone-500 italic">
                        Izoh: {receipt.notes}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-stone-500 font-semibold">Umumiy Tushum / Qiymat:</div>
                    <div className="text-xl font-black text-stone-950">
                      {formatMoney(receipt.total)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t-2 border-emerald-600 pt-3 flex items-center justify-between bg-emerald-50/60 p-3 rounded-xl">
                  <div className="text-xs font-bold text-emerald-950">
                    Buyurtma Xulosasi: Jami {receipt.items.length} xil tovar, {totalUnits} dona buyurtma ro'yxati.
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    * Narxlar ko'rsatilmagan (Ta'minotchi / Buyurtma nusxasi)
                  </div>
                </div>
              )}

              {/* Signature Blocks */}
              <div className="mt-8 pt-6 border-t border-stone-300 grid grid-cols-2 gap-8 text-[11px]">
                <div className="space-y-4">
                  <div className="font-bold text-stone-800">
                    Topshirdi (Sotuvchi):
                  </div>
                  <div className="border-b border-stone-400 pb-1 text-stone-600">
                    {receipt.cashierName || STORE_INFO.accountantName} ____________ (imzo)
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="font-bold text-stone-800">
                    Qabul qilib oldi (Mijoz / Qayerga):
                  </div>
                  <div className="border-b border-stone-400 pb-1 text-stone-600">
                    {receipt.customerName} ____________ (imzo)
                  </div>
                </div>
              </div>

              {/* Stamp / Note watermark */}
              <div className="mt-6 text-center text-[10px] text-stone-400">
                {showPrices
                  ? 'Ushbu tovar-nakladnoy elektron kassa tizimi orqali shakllantirildi.'
                  : "Ushbu buyurtma ro'yxati Paxtaobod Beeline elektron kassa tizimi orqali shakllantirildi."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

