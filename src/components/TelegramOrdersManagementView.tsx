import React, { useState, useEffect } from 'react';
import { 
  OnlineOrder, 
  OnlineOrderStatus, 
  Product, 
  SaleReceiptData, 
  StoreSettings 
} from '../types';
import { formatMoney, formatDate } from '../utils/formatters';
import { playCashRegisterChime } from '../utils/audioAlert';
import { TelegramMiniAppView } from './TelegramMiniAppView';
import { 
  Smartphone, 
  Printer, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle, 
  RefreshCw, 
  Phone, 
  MapPin, 
  ExternalLink, 
  Copy, 
  Check, 
  Settings, 
  Play, 
  Code2, 
  ShoppingBag,
  History,
  SlidersHorizontal,
  Volume2
} from 'lucide-react';

interface TelegramOrdersManagementViewProps {
  orders: OnlineOrder[];
  products: Product[];
  storeInfo: StoreSettings;
  autoPrintEnabled: boolean;
  onToggleAutoPrint: (enabled: boolean) => void;
  audioAlertEnabled: boolean;
  onToggleAudioAlert: (enabled: boolean) => void;
  onPrintOrderReceipt: (order: OnlineOrder) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: OnlineOrderStatus) => void;
  onRefreshOrders: () => void;
}

export const TelegramOrdersManagementView: React.FC<TelegramOrdersManagementViewProps> = ({
  orders,
  products,
  storeInfo,
  autoPrintEnabled,
  onToggleAutoPrint,
  audioAlertEnabled,
  onToggleAudioAlert,
  onPrintOrderReceipt,
  onUpdateOrderStatus,
  onRefreshOrders
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'settings' | 'guide' | 'simulator'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load the complete history as soon as this POS section opens and keep it
  // current even when there are no pending/unprinted orders.
  useEffect(() => {
    onRefreshOrders();
    const interval = window.setInterval(onRefreshOrders, 10000);
    return () => window.clearInterval(interval);
  }, []);

  // Current domain URL for Mini App
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const miniAppUrl = `${currentOrigin}/?view=miniapp`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(miniAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleTestSoundAndPrint = () => {
    playCashRegisterChime();
    if (orders.length > 0) {
      onPrintOrderReceipt(orders[0]);
    } else {
      alert("Qo'ng'iroq tovushi chalindi! Haqiqiy chek chiqarish uchun kamida bitta buyurtma bo'lishi kerak.");
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshOrders();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'unprinted') return !o.isPrinted;
    return o.status === statusFilter;
  });

  // Aggregated Stats
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt.startsWith(todayDateStr));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingCount = orders.filter(o => o.status === 'yangi' || !o.isPrinted).length;

  const getStatusBadge = (status: OnlineOrderStatus, isPrinted: boolean) => {
    switch (status) {
      case 'yangi':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Yangi Zakaz
          </span>
        );
      case 'chiqarildi':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <Printer className="w-3 h-3 text-sky-400" />
            Printerda Chiqarildi
          </span>
        );
      case 'yetkazilmoqda':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <Truck className="w-3 h-3 text-purple-400" />
            Yetkazilmoqda
          </span>
        );
      case 'bajarildi':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Bajarildi
          </span>
        );
      case 'bekor_qilindi':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            Bekor Qilindi
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner & Stats Overview */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 border border-stone-800 rounded-3xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Telegram Mini App & Online Savdo Kassasi
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Faol & Sinxron
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Mijoz Telegram Mini Appda zakaz berishi bilan avtomatik kassaga tushadi va printerdan chek chiqadi.
              </p>
            </div>
          </div>

          {/* Quick Auto-Print Status Badges */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              autoPrintEnabled 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-stone-900 border-stone-800 text-stone-400'
            }`}>
              <Printer className={`w-4 h-4 ${autoPrintEnabled ? 'text-emerald-400 animate-pulse' : 'text-stone-500'}`} />
              <span>Avto-Printer: {autoPrintEnabled ? 'YOQILGAN' : 'O\'CHIRILGAN'}</span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 cursor-pointer transition-colors"
              title="Zakazlarni yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-800/80">
          <div className="p-3 bg-stone-900/90 rounded-2xl border border-stone-800/90">
            <p className="text-[11px] font-bold text-stone-400">Bugungi Online Zakazlar</p>
            <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
              {todayOrders.length} ta
            </p>
          </div>

          <div className="p-3 bg-stone-900/90 rounded-2xl border border-stone-800/90">
            <p className="text-[11px] font-bold text-stone-400">Bugungi Online Tushum</p>
            <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
              {formatMoney(todayRevenue)}
            </p>
          </div>

          <div className="p-3 bg-stone-900/90 rounded-2xl border border-stone-800/90">
            <p className="text-[11px] font-bold text-stone-400">Kutilayotgan (Yangi)</p>
            <p className={`text-lg font-black font-mono mt-0.5 ${pendingCount > 0 ? 'text-rose-400 animate-pulse' : 'text-stone-300'}`}>
              {pendingCount} ta
            </p>
          </div>

          <div className="p-3 bg-stone-900/90 rounded-2xl border border-stone-800/90">
            <p className="text-[11px] font-bold text-stone-400">Kassa Printer Signali</p>
            <p className="text-lg font-black text-sky-400 font-mono mt-0.5 flex items-center gap-1">
              <Volume2 className="w-4 h-4" />
              {audioAlertEnabled ? "Ovozli Qo'ng'iroq" : "Ovozsiz"}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-950 border border-stone-800 rounded-2xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'orders'
              ? 'bg-amber-400 text-stone-950 font-black shadow'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Buyurtmalar Tarixi</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'settings'
              ? 'bg-amber-400 text-stone-950 font-black shadow'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Avto-Printer & Ovoz Sozlamalari</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('guide')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'guide'
              ? 'bg-amber-400 text-stone-950 font-black shadow'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Ulanish Qo'llanmasi (BotFather & API)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'simulator'
              ? 'bg-amber-400 text-stone-950 font-black shadow'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Play className="w-3.5 h-3.5 text-sky-400" />
          <span>📱 Mini Appni Sinab Ko'rish</span>
        </button>
      </div>

      {/* SUB-TAB 1: ORDERS LIST */}
      {activeSubTab === 'orders' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-base font-black text-stone-900">Telegram buyurtmalari tarixi</h3>
              <p className="text-xs text-stone-500">Yangi va oldingi barcha buyurtmalar shu yerda saqlanib ko'rinadi.</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 text-xs font-black">
              Jami: {orders.length} ta
            </span>
          </div>
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-950 border border-stone-800 rounded-2xl">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: "Barchasi" },
                { id: 'unprinted', label: "Chiqarilmaganlar" },
                { id: 'yangi', label: "Yangi" },
                { id: 'chiqarildi', label: "Chiqarildi" },
                { id: 'yetkazilmoqda', label: "Yetkazilmoqda" },
                { id: 'bajarildi', label: "Bajarildi" },
                { id: 'bekor_qilindi', label: "Bekor qilingan" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-stone-800 text-amber-400 border border-amber-400/40'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-stone-400 font-mono">
              Topildi: {filteredOrders.length} ta zakaz
            </span>
          </div>

          {/* Orders Cards / Table */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-stone-950 border border-stone-800 rounded-3xl">
              <ShoppingBag className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-stone-300">Hech qanday online zakaz topilmadi</p>
              <p className="text-xs text-stone-500 mt-1">
                Telegram Mini Appdan zakaz berilganda ular avtomatik shu yerda aks etadi va printerdan chek chiqadi.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`p-4 rounded-3xl border transition-all ${
                    !order.isPrinted
                      ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/5'
                      : 'bg-stone-950 border-stone-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center font-mono font-black text-amber-400 text-xs">
                        #{order.orderNumber.slice(-4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-sm text-white">
                            {order.orderNumber}
                          </h3>
                          <span className="text-xs font-mono text-stone-400">
                            (Chek: #{order.receiptNumber})
                          </span>
                          {getStatusBadge(order.status, order.isPrinted)}
                        </div>
                        <p className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <span>{formatDate(order.createdAt)}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-bold uppercase">{order.paymentMethod}</span>
                          <span>•</span>
                          <span>{order.deliveryType === 'yetkazib_berish' ? 'Yetkazib berish (Kuryer)' : 'Olib ketish'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => onPrintOrderReceipt(order)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
                        title="Kassa chekini printerdan chiqarish"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Chekni Chiqarish</span>
                      </button>

                      {/* Status changer select */}
                      <select
                        value={order.status}
                        onChange={(e) => onUpdateOrderStatus(order.id, e.target.value as OnlineOrderStatus)}
                        className="bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-1.5 text-xs text-stone-200 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value="yangi">Yangi</option>
                        <option value="chiqarildi">Chiqarildi</option>
                        <option value="yetkazilmoqda">Yetkazilmoqda</option>
                        <option value="bajarildi">Bajarildi</option>
                        <option value="bekor_qilindi">Bekor</option>
                      </select>
                    </div>
                  </div>

                  {/* Customer and Items Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
                    {/* Customer Info */}
                    <div className="p-3 bg-stone-900/60 rounded-2xl border border-stone-800/80 space-y-1.5">
                      <p className="font-bold text-stone-300 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mijoz: {order.customerName}</span>
                      </p>
                      <p className="text-stone-400 font-mono pl-5">
                        Tel: <a href={`tel:${order.customerPhone}`} className="text-amber-400 hover:underline">{order.customerPhone}</a>
                      </p>
                      {order.customerAddress && (
                        <p className="text-stone-400 flex items-start gap-1.5 pl-0.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>Manzil: {order.customerAddress}</span>
                        </p>
                      )}
                      {order.notes && (
                        <p className="text-stone-400 italic pl-5">
                          Izoh: "{order.notes}"
                        </p>
                      )}
                    </div>

                    {/* Ordered Items Summary */}
                    <div className="p-3 bg-stone-900/60 rounded-2xl border border-stone-800/80 space-y-1.5">
                      <p className="font-bold text-stone-300">
                        Buyurtma tarkibi ({order.items.length} xil tovar):
                      </p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-stone-400 font-mono text-[11px]">
                            <span className="truncate pr-2">• {it.productName} ({it.quantity} dona)</span>
                            <span className="text-stone-200 shrink-0 font-bold">{formatMoney(it.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-1.5 border-t border-stone-800 flex justify-between items-center font-black">
                        <span className="text-stone-300">Jami summa:</span>
                        <span className="text-amber-400 font-mono text-sm">{formatMoney(order.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: AUTO-PRINT SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="p-5 bg-stone-950 border border-stone-800 rounded-3xl space-y-5">
          <div>
            <h3 className="text-base font-black text-white">
              Avtomatik Kassa Printeri va Tovush Sozlamalari
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Online buyurtma kelganda kassir hech narsa bosishi shart emas — tizim o'zi tovush chiqaradi va printerga chek yuboradi!
            </p>
          </div>

          <div className="space-y-3">
            {/* Toggle 1: Auto Print Receipts */}
            <div className="p-4 bg-stone-900 rounded-2xl border border-stone-800 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Avtomatik Printerdan Chiqarish (Auto-Print)
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Telegram Mini Appdan yangi zakaz tushishi bilan bir lahzada termal printerdan 58mm / 80mm chek chiqariladi.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoPrintEnabled}
                  onChange={(e) => onToggleAutoPrint(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>

            {/* Toggle 2: Audio Bell Chime */}
            <div className="p-4 bg-stone-900 rounded-2xl border border-stone-800 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Kassa Qo'ng'irog'i Tovushli Signal (Audio Bell)
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Yangi zakaz kelganda kompyuter yoki telefon dinamikidan kassa qo'ng'irog'i (Chime) jaranglaydi.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={audioAlertEnabled}
                  onChange={(e) => onToggleAudioAlert(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-400"></div>
              </label>
            </div>
          </div>

          {/* Test Sound & Print Button */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestSoundAndPrint}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer border border-stone-700"
            >
              <Play className="w-4 h-4 text-amber-400" />
              <span>🔔 Tovush va Printerni Sinash (Test)</span>
            </button>
          </div>

          {/* POS Hardware Printing Tips */}
          <div className="p-4 bg-stone-900/60 rounded-2xl border border-stone-800 space-y-2 text-xs text-stone-400">
            <h5 className="font-bold text-stone-200">
              💡 Do'kondagi termal printerlar (Xprinter, Rongta, EPSON, POS-58/80) uchun maslahat:
            </h5>
            <ul className="list-disc pl-5 space-y-1">
              <li>Brauzerda <code>Ctrl + P</code> bosib, asosiy printerni tanlang va <b>"Margins"</b> ni <i>None</i> qilib qo'ying.</li>
              <li>Avtomatik oynani ko'rsatmasdan birdaniga chiqarish uchun (Silent Printing) Chrome brauzerini <code>--kiosk --kiosk-printing</code> parametri bilan ishga tushirish mumkin.</li>
            </ul>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: GUIDE & API */}
      {activeSubTab === 'guide' && (
        <div className="p-5 bg-stone-950 border border-stone-800 rounded-3xl space-y-5">
          <div>
            <h3 className="text-base font-black text-white">
              Telegram Bot & Mini Appni Ulanish Qo'llanmasi
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              O'zingizning Telegram botingizga ushbu Mini Appni ulash 1 daqiqa vaqt oladi.
            </p>
          </div>

          {/* Ready Mini App URL Box */}
          <div className="p-4 bg-stone-900 rounded-2xl border border-amber-400/30 space-y-2">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Sizning Tayyor Telegram Mini App Web Havolangiz:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={miniAppUrl}
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-200"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? "Nusxalandi!" : "Nusxa olish"}</span>
              </button>
            </div>
          </div>

          {/* 3 Simple Steps for BotFather */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-white text-sm">
              @BotFather orqali menyu tugmasiga ulash:
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-1">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <h5 className="font-bold text-stone-200 mt-2">BotFatherni oching</h5>
                <p className="text-stone-400 text-[11px]">
                  Telegramda <code>@BotFather</code> ga kiring va <code>/setmenubutton</code> buyrug'ini yuboring.
                </p>
              </div>

              <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-1">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <h5 className="font-bold text-stone-200 mt-2">Botingizni tanlang</h5>
                <p className="text-stone-400 text-[11px]">
                  Do'kon botingizni tanlang, tugma nomini yozing (masalan: <i>🛍️ Mahsulotlar / Buyurtma</i>).
                </p>
              </div>

              <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-1">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-xs">
                  3
                </span>
                <h5 className="font-bold text-stone-200 mt-2">Havolani qo'ying</h5>
                <p className="text-stone-400 text-[11px]">
                  Yuqoridagi nusxalangan Mini App havolasini yuboring. Bo'ldi, botingiz to'liq ishlaydi!
                </p>
              </div>
            </div>
          </div>

          {/* REST API Endpoints Documentation for Custom Mini Apps */}
          <div className="p-4 bg-stone-900/80 rounded-2xl border border-stone-800 space-y-3 text-xs">
            <h4 className="font-bold text-stone-200 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>O'zingizning alohida Mini App kodingiz bo'lsa (REST API):</span>
            </h4>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="p-2.5 bg-stone-950 rounded-xl border border-stone-800">
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded mr-2">GET</span>
                <span className="text-stone-300">/api/v1/telegram/miniapp/products</span>
                <p className="text-stone-500 font-sans text-[11px] mt-1">Barcha tovarlar ro'yxati, narxlari va ombordagi qoldiqlari (katalog).</p>
              </div>

              <div className="p-2.5 bg-stone-950 rounded-xl border border-stone-800">
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 font-bold rounded mr-2">POST</span>
                <span className="text-stone-300">/api/v1/telegram/miniapp/order</span>
                <p className="text-stone-500 font-sans text-[11px] mt-1">Zakaz yuborish. Kassa omboridan tovar ayiriladi, sotuv kiritiladi va chek chiqariladi.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: LIVE SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="p-5 bg-stone-950 border border-stone-800 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white">
                📱 Interaktiv Telegram Mini App Simulyatori
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Xuddi mijoz Telegramda ko'rganidek, shu yerning o'zida tovarlarni savatga qo'shib, zakaz berib ko'ring!
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-sky-500/20 text-sky-300 rounded-xl border border-sky-500/30 font-mono font-bold">
              Jonli Rejim
            </span>
          </div>

          {/* Smartphone Frame Container */}
          <div className="flex justify-center py-4 bg-stone-900/40 rounded-3xl border border-stone-800/80">
            <div className="w-full max-w-sm rounded-[40px] border-4 border-stone-700 bg-stone-950 shadow-2xl overflow-hidden relative">
              {/* iPhone Notch/Dynamic Island */}
              <div className="w-28 h-4 bg-stone-800 rounded-full mx-auto my-2 shrink-0" />
              
              <div className="h-[600px] overflow-y-auto">
                <TelegramMiniAppView
                  products={products}
                  onOrderPlaced={() => {
                    playCashRegisterChime();
                    onRefreshOrders();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
