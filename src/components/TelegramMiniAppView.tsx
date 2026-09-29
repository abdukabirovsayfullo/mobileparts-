import React, { useState, useEffect, useMemo } from 'react';
import { Product, PaymentMethod } from '../types';
import { formatMoney } from '../utils/formatters';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Truck, 
  Clock, 
  AlertCircle, 
  Send,
  Smartphone,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Receipt
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

interface TelegramMiniAppViewProps {
  products: Product[];
  onOrderPlaced?: (orderData: any) => void;
  isStandalone?: boolean;
}

export const TelegramMiniAppView: React.FC<TelegramMiniAppViewProps> = ({
  products: initialProducts,
  onOrderPlaced,
  isStandalone = false
}) => {
  // Telegram WebApp detection
  const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  const tgUser = tg?.initDataUnsafe?.user;

  // Local state
  const [products, setProducts] = useState<Product[]>(() => {
    if (initialProducts && initialProducts.length > 0) return initialProducts;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pb_beeline_products_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });
  const [categories, setCategories] = useState<string[]>(['Barchasi']);
  const [selectedCategory, setSelectedCategory] = useState<string>('Barchasi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Form fields
  const [customerName, setCustomerName] = useState<string>(
    tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>('+998 ');
  const [deliveryType, setDeliveryType] = useState<'olib_ketish' | 'yetkazib_berish'>('olib_ketish');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('click_payme');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch live products from backend to ensure catalog is always 100% up-to-date
  const fetchLiveProducts = async () => {
    try {
      const res = await fetch('/api/v1/telegram/miniapp/products');
      if (res.ok) {
        const data = await res.json();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      }
    } catch (e) {
      console.warn('[TMA] Failed to fetch live products, using props:', e);
    }
  };

  useEffect(() => {
    fetchLiveProducts();

    // Notify Telegram WebApp that the app is ready
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch (e) {
        console.warn('Telegram WebApp expand error:', e);
      }
    }
  }, []);

  // Update categories when products change
  useEffect(() => {
    if (products.length > 0) {
      const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
      setCategories(['Barchasi', ...cats]);
    }
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'Barchasi' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product: Product) => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Cart calculations
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const deliveryFee = deliveryType === 'yetkazib_berish' ? 15000 : 0;
  const grandTotal = subtotal + deliveryFee;

  // Submit order to POS backend
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage("Savat bo'sh. Iltimos tovar tanlang.");
      return;
    }

    if (!customerPhone || customerPhone.replace(/\D/g, '').length < 9) {
      setErrorMessage("Iltimos, to'liq telefon raqamingizni kiriting (+998...)");
      return;
    }

    if (deliveryType === 'yetkazib_berish' && !customerAddress.trim()) {
      setErrorMessage("Yetkazib berish manzilini kiriting.");
      return;
    }

    setSubmittingOrder(true);

    try {
      const payload = {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.sellingPrice
        })),
        customerName: customerName.trim() || (tgUser?.first_name || 'Mijoz'),
        customerPhone: customerPhone.trim(),
        customerAddress: deliveryType === 'yetkazib_berish' ? customerAddress.trim() : "Do'kondan olib ketish",
        deliveryType,
        paymentMethod,
        telegramUserId: tgUser?.id,
        telegramUsername: tgUser?.username,
        notes: notes.trim()
      };

      const res = await fetch('/api/v1/telegram/miniapp/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Buyurtmani qabul qilishda xatolik yuz berdi");
      }

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

      setConfirmedOrder(data);
      setCart([]);
      setIsCartOpen(false);
      setIsCheckingOut(false);

      if (onOrderPlaced) {
        onOrderPlaced(data);
      }

    } catch (err: any) {
      console.error('[TMA] Order submit error:', err);
      setErrorMessage(err?.message || "Buyurtma yuborishda xatolik. Qaytadan urinib ko'ring.");
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans max-w-md mx-auto relative shadow-2xl border-x border-stone-800">
      {/* Mini App Header */}
      <header className="sticky top-0 z-30 bg-stone-950/95 backdrop-blur-md border-b border-stone-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-stone-950 shadow-md font-black">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white leading-tight">
                  Paxtaobod Beeline POS
                </h1>
                <span className="text-[9px] px-1.5 py-0.2 bg-sky-500/20 text-sky-400 rounded-full font-bold border border-sky-500/30">
                  Mini App
                </span>
              </div>
              <p className="text-[11px] text-stone-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                Andijon, Paxtaobod markazi
              </p>
            </div>
          </div>

          {/* Cart Icon in Header */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer transition-colors border border-stone-700"
            title="Savatni ko'rish"
          >
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-stone-950 font-black rounded-full w-5 h-5 text-[11px] flex items-center justify-center shadow">
                {totalItemsCount}
              </span>
            )}
          </button>
        </div>

        {/* Live Search Bar */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tovar yoki brend qidirish (Hoco, Remax, Type-C)..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Horizontal Scroll Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none no-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-stone-950 shadow-sm font-black'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3 pb-24 space-y-3">
        {/* Info banner */}
        <div className="p-3 bg-gradient-to-r from-sky-950/40 to-stone-900 border border-sky-500/20 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <p className="font-bold text-sky-200">Onlayn Buyurtma & Kassaga Integratsiya</p>
              <p className="text-[11px] text-stone-400">Zakaz tushishi bilan do'kon printeridan chek chiqadi</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-500/30">
            Jonli
          </span>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShoppingBag className="w-12 h-12 text-stone-600 mx-auto mb-3" />
            <p className="text-stone-400 font-bold text-sm">Tovar topilmadi</p>
            <p className="text-stone-500 text-xs mt-1">Boshqa so'z bilan qidirib ko'ring yoki toifani almashtiring</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((product) => {
              const inCart = cart.find(item => item.product.id === product.id);
              const isOutOfStock = product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className={`bg-stone-950 border rounded-2xl p-3 flex flex-col justify-between transition-all relative ${
                    inCart 
                      ? 'border-amber-400/80 shadow-md shadow-amber-500/10' 
                      : 'border-stone-800 hover:border-stone-700'
                  }`}
                >
                  {/* Brand & Stock badges */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 truncate max-w-[80px]">
                      {product.brand || 'Original'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      isOutOfStock
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : product.stock <= 3
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-stone-800 text-stone-400'
                    }`}>
                      {isOutOfStock ? 'Tugagan' : `${product.stock} dona`}
                    </span>
                  </div>

                  {/* Product Title */}
                  <div className="mb-2">
                    <h3 className="text-xs font-bold text-stone-100 line-clamp-2 leading-snug" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-0.5 truncate">
                      {product.category}
                    </p>
                  </div>

                  {/* Price & Action Button */}
                  <div className="pt-2 border-t border-stone-800/80 mt-auto flex items-center justify-between gap-1">
                    <div>
                      <p className="text-[10px] text-stone-400">Narxi:</p>
                      <p className="text-xs font-black text-amber-400 font-mono leading-tight">
                        {formatMoney(product.sellingPrice)}
                      </p>
                    </div>

                    {/* Quantity controls or Add button */}
                    {inCart ? (
                      <div className="flex items-center gap-1 bg-stone-800 rounded-xl p-0.5 border border-amber-400/40">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-stone-700 text-white flex items-center justify-center hover:bg-stone-600 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-mono font-bold text-white">
                          {inCart.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, 1)}
                          disabled={inCart.quantity >= product.stock}
                          className="w-6 h-6 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center hover:bg-amber-300 transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className="w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 font-bold"
                        title="Savatga qo'shish"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemsCount > 0 && !isCartOpen && !confirmedOrder && (
        <div className="fixed bottom-3 left-0 right-0 max-w-md mx-auto px-3 z-30 pointer-events-auto animate-bounce-short">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-2xl shadow-xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center text-xs font-mono font-bold">
                {totalItemsCount}
              </span>
              <span className="text-sm tracking-tight font-black">
                Savatni ko'rish
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black">
                {formatMoney(subtotal)}
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart & Checkout Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-stone-950 border-t border-stone-800 rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden max-w-md w-full mx-auto animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/60">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-black text-white">
                  {isCheckingOut ? "Buyurtmani rasmiylashtirish" : `Savat (${totalItemsCount} tovar)`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isCheckingOut) setIsCheckingOut(false);
                  else setIsCartOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {!isCheckingOut ? (
                // Step 1: Cart Items Review
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-[11px] font-mono text-amber-400 mt-0.5">
                          {formatMoney(item.product.sellingPrice)} x {item.quantity} = {formatMoney(item.product.sellingPrice * item.quantity)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-7 h-7 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-7 h-7 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-7 h-7 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center ml-1"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="p-3 bg-stone-900/80 rounded-2xl border border-stone-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-400">
                      <span>Tovarlar qiymati:</span>
                      <span className="font-mono text-white font-bold">{formatMoney(subtotal)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Step 2: Checkout Form
                <form id="tma-checkout-form" onSubmit={handleSubmitOrder} className="space-y-3.5 text-xs">
                  {/* Customer Name */}
                  <div>
                    <label className="block text-stone-400 font-bold mb-1">
                      Ismingiz:
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Masalan: Sardorbek"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>

                  {/* Customer Phone */}
                  <div>
                    <label className="block text-stone-400 font-bold mb-1">
                      Telefon raqamingiz: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono font-bold"
                    />
                  </div>

                  {/* Delivery Mode */}
                  <div>
                    <label className="block text-stone-400 font-bold mb-1">
                      Yetkazib berish usuli:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('olib_ketish')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-all ${
                          deliveryType === 'olib_ketish'
                            ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-black'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 mb-1" />
                        <span>Olib ketish</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">Bepul</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryType('yetkazib_berish')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-all ${
                          deliveryType === 'yetkazib_berish'
                            ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-black'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <Truck className="w-4 h-4 mb-1" />
                        <span>Kuryer orqali</span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">+15 000 so'm</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Address (if Courier) */}
                  {deliveryType === 'yetkazib_berish' && (
                    <div>
                      <label className="block text-stone-400 font-bold mb-1">
                        Yetkazish manzili: <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Paxtaobod tumani, Bo'ston MFY, 12-uy..."
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400 text-xs"
                      />
                    </div>
                  )}

                  {/* Payment Method */}
                  <div>
                    <label className="block text-stone-400 font-bold mb-1">
                      To'lov turi:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('click_payme')}
                        className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                          paymentMethod === 'click_payme'
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        💳 Click / Payme
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('naqd')}
                        className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                          paymentMethod === 'naqd'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        💵 Naqd pul
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('uzum')}
                        className={`p-2 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                          paymentMethod === 'uzum'
                            ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        🍇 Uzum Bank
                      </button>
                    </div>
                  </div>

                  {/* Order notes */}
                  <div>
                    <label className="block text-stone-400 font-bold mb-1">
                      Qo'shimcha izoh (ixtiyoriy):
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Masalan: Qora rangli bo'lsin yoki soat 14:00 dan keyin qo'ng'iroq qiling..."
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-400 text-xs resize-none"
                    />
                  </div>

                  {/* Summary Box */}
                  <div className="p-3 bg-stone-900 rounded-2xl border border-stone-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-400">
                      <span>Tovarlar:</span>
                      <span className="font-mono text-stone-200 font-bold">{formatMoney(subtotal)}</span>
                    </div>
                    {deliveryType === 'yetkazib_berish' && (
                      <div className="flex justify-between text-stone-400">
                        <span>Yetkazib berish:</span>
                        <span className="font-mono text-amber-400 font-bold">15 000 so'm</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-stone-800 flex justify-between items-center text-sm font-black">
                      <span className="text-white">Jami to'lov:</span>
                      <span className="font-mono text-amber-400 text-base">{formatMoney(grandTotal)}</span>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Drawer Footer Buttons */}
            <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center gap-2">
              {!isCheckingOut ? (
                <button
                  type="button"
                  onClick={() => setIsCheckingOut(true)}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-2xl text-sm transition-all shadow cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Buyurtmani rasmiylashtirish</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIsCheckingOut(false)}
                    className="px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-2xl text-xs cursor-pointer transition-colors"
                  >
                    Orqaga
                  </button>
                  <button
                    type="submit"
                    form="tma-checkout-form"
                    disabled={submittingOrder}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black rounded-2xl text-sm transition-all shadow cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingOrder ? (
                      <span>Kassaga yuborilmoqda...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Tasdiqlash & Kassa Printeriga</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmed Screen Modal */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-950 border border-stone-800 rounded-3xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                ✅ Kassaga Qabul Qilindi
              </span>
              <h3 className="text-lg font-black text-white mt-2">
                Buyurtmangiz Qabul Qilindi!
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Buyurtma kassa dasturiga tushdi va avtomatik printerdan chek chiqarildi.
              </p>
            </div>

            {/* Order Details Card */}
            <div className="bg-stone-900/80 rounded-2xl p-3 border border-stone-800 text-xs space-y-2 text-left font-mono">
              <div className="flex justify-between">
                <span className="text-stone-400">Buyurtma №:</span>
                <span className="text-amber-400 font-bold">#{confirmedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Kassa Cheki:</span>
                <span className="text-emerald-400 font-bold">#{confirmedOrder.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Jami summa:</span>
                <span className="text-white font-bold">{formatMoney(confirmedOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Yetkazish:</span>
                <span className="text-stone-200">{confirmedOrder.order?.deliveryType === 'yetkazib_berish' ? 'Kuryer orqali' : 'Do\'kondan olib ketish'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmedOrder(null)}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-2xl text-xs transition-all cursor-pointer shadow"
            >
              Yana Xarid Qilish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
