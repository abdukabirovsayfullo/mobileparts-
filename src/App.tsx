import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, StockMovement, DebtRecord, PaymentMethod, SaleReceiptData, CustomerProfile, SupplierDebtRecord, StoreSettings, AuthUser } from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_MOVEMENTS, 
  INITIAL_DEBTS, 
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIER_DEBTS,
  DEFAULT_CATEGORIES,
  STORE_INFO 
} from './data/initialData';
import { Header, AccountingTab } from './components/Header';
import { CompactSidebar as Sidebar } from './components/CompactSidebar';
import { CompactTopNavbar as TopNavbar } from './components/CompactTopNavbar';
import { DailyReportView } from './components/DailyReportView';
import { KirimFormView } from './components/KirimFormView';
import { ChiqimFormView } from './components/ChiqimFormView';
import { MovementJournalView } from './components/MovementJournalView';
import { StockBalanceView } from './components/StockBalanceView';
import { DebtsView } from './components/DebtsView';
import { SupplierDebtsView } from './components/SupplierDebtsView';
import { HisobchiPanelView } from './components/HisobchiPanelView';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { VazvratModal } from './components/VazvratModal';
import { WorkerReturnModal } from './components/WorkerReturnModal';
import { WorkerDebtPanel } from './components/WorkerDebtPanel';
import { ExcelImportModal } from './components/ExcelImportModal';
import { PdfReportModal, PdfReportType } from './components/PdfReportModal';
import { PhotoKirimModal } from './components/PhotoKirimModal';
import { ApiIntegrationModal } from './components/ApiIntegrationModal';
import { AiAnalystView } from './components/AiAnalystView';
import { TelegramMiniAppView } from './components/TelegramMiniAppView';
import { TelegramOrdersManagementView } from './components/TelegramOrdersManagementView';
import { LoginScreen } from './components/LoginScreen';
import { WorkerManagement } from './components/WorkerManagement';
import { CashExpensePanel } from './components/CashExpensePanel';
import { CashShiftPanel } from './components/CashShiftPanel';
import { CustomersPanel } from './components/CustomersPanel';
import { ReportsDashboard } from './components/ReportsDashboard';
import { OnlineOrder, OnlineOrderStatus } from './types';
import { playCashRegisterChime } from './utils/audioAlert';
import { customerDebtTotal, saleAccounting, movementPaymentSummary, clampDebtPayment } from './utils/saleAccounting';
import { 
  RotateCcw, Smartphone, ShieldCheck, HelpCircle, Monitor, Lock, ShieldAlert,
  ShoppingBag, ArrowDownLeft, Package, BookOpen, SlidersHorizontal, X, Truck, BarChart3, Calculator, FileText, KeyRound, FileSpreadsheet, Camera, Code2, Sparkles
} from 'lucide-react';

const STORAGE_KEYS = {
  PRODUCTS: 'pb_beeline_products_v2',
  MOVEMENTS: 'pb_beeline_movements_v2',
  DEBTS: 'pb_beeline_debts_v2',
  SUPPLIER_DEBTS: 'pb_beeline_supplier_debts_v2',
  CUSTOMERS: 'pb_beeline_customers_v2',
  STORE_INFO: 'pb_beeline_store_info_v2',
  CATEGORIES: 'pb_beeline_categories_v2'
};

const DEMO_PRODUCT_KEYS = new Set(
  INITIAL_PRODUCTS.map(product => `${product.id}\u0000${product.barcode}\u0000${product.name}`)
);
const DEMO_MOVEMENT_IDS = new Set(INITIAL_MOVEMENTS.map(item => item.id));
const DEMO_DEBT_IDS = new Set(INITIAL_DEBTS.map(item => item.id));
const DEMO_SUPPLIER_DEBT_IDS = new Set(INITIAL_SUPPLIER_DEBTS.map(item => item.id));
const DEMO_CUSTOMER_IDS = new Set(INITIAL_CUSTOMERS.map(item => item.id));

const removeDemoProducts = (list: Product[]): Product[] => list.filter(product =>
  !DEMO_PRODUCT_KEYS.has(`${product.id}\u0000${product.barcode}\u0000${product.name}`)
);
const removeDemoMovements = (list: StockMovement[]) => list.filter(item => !DEMO_MOVEMENT_IDS.has(item.id));
const removeDemoDebts = (list: DebtRecord[]) => list.filter(item => !DEMO_DEBT_IDS.has(item.id));
const removeDemoSupplierDebts = (list: SupplierDebtRecord[]) => list.filter(item => !DEMO_SUPPLIER_DEBT_IDS.has(item.id));
const removeDemoCustomers = (list: CustomerProfile[]) => list.filter(item => !DEMO_CUSTOMER_IDS.has(item.id));

// Keep the browser's order history when the Render free instance restarts,
// while letting the newest server copy win for status/print changes.
const mergeOnlineOrders = (localOrders: OnlineOrder[], serverOrders: OnlineOrder[]): OnlineOrder[] => {
  const merged = new Map<string, OnlineOrder>();
  localOrders.forEach(order => merged.set(order.id, order));
  serverOrders.forEach(order => merged.set(order.id, order));
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const isAdminUnlocked = authUser?.role === 'owner';
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<AccountingTab | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Notebook ekranida chap menyuni yig'ish (tanlov shu qurilmada eslab qolinadi; standart: kichik ekranda yig'ilgan)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mp_sidebar_collapsed');
      if (saved !== null) return saved === '1';
    } catch { /* localStorage mavjud emas */ }
    return typeof window !== 'undefined' && window.innerWidth < 1500;
  });
  const setSidebarCollapsedPersist = (value: boolean) => {
    setSidebarCollapsed(value);
    try { localStorage.setItem('mp_sidebar_collapsed', value ? '1' : '0'); } catch { /* ignore */ }
  };

  // If unlocked, default to 'report'; if locked for employee/cashier, default to 'chiqim'
  const [activeTabState, setActiveTabState] = useState<AccountingTab>('chiqim');
  // Ishchi faqat Kassa (sotuv) va Nasiya bo'limlarini ko'ra oladi. Boshqa bo'limga o'tishga urinish kassaga qaytaradi.
  const WORKER_TABS: AccountingTab[] = ['chiqim', 'debts', 'customers'];
  const [presetCustomer, setPresetCustomer] = useState<{ name: string; phone: string; address: string; nonce: number } | null>(null);
  const isWorkerUser = authUser?.role === 'worker';
  const activeTab: AccountingTab = isWorkerUser && !WORKER_TABS.includes(activeTabState) ? 'chiqim' : activeTabState;
  const setActiveTab = (tab: AccountingTab) =>
    setActiveTabState(authUser?.role === 'worker' && !WORKER_TABS.includes(tab) ? 'chiqim' : tab);
  const [activeReceiptToPrint, setActiveReceiptToPrint] = useState<SaleReceiptData | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Vazvrat modal state
  const [isVazvratModalOpen, setIsVazvratModalOpen] = useState(false);
  const [isWorkerReturnOpen, setIsWorkerReturnOpen] = useState(false);
  const [vazvratInitialMovement, setVazvratInitialMovement] = useState<StockMovement | undefined>(undefined);

  // Excel / CSV bulk import modal state
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

  // AI Photo Kirim modal state (Camera + Gemini OCR)
  const [isPhotoKirimModalOpen, setIsPhotoKirimModalOpen] = useState(false);

  // PDF reports modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<PdfReportType>('out_of_stock');
  const handleOpenPdfReports = (type?: PdfReportType) => {
    setPdfReportType(type || 'out_of_stock');
    setIsPdfModalOpen(true);
  };

  // REST API & Tashqi Integratsiya modal holati
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isSyncingWithServer, setIsSyncingWithServer] = useState(false);
  const serverSyncReadyRef = useRef(false);
  const applyingServerStateRef = useRef(false);
  const serverRevisionRef = useRef<string | null>(null);
  const legacyHistoryImportedRef = useRef(false);

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.user) {
          setAuthUser(data.user);
          setActiveTab(data.user.role === 'owner' ? 'report' : 'chiqim');
        }
      })
      .finally(() => setIsAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let lastTouch = 0;
    let ownerTimer: ReturnType<typeof setTimeout> | undefined;
    const logoutLocally = () => {
      setAuthUser(null);
      setActiveTab('chiqim');
    };
    const registerActivity = () => {
      const now = Date.now();
      if (authUser.role === 'owner') {
        if (ownerTimer) clearTimeout(ownerTimer);
        ownerTimer = setTimeout(logoutLocally, 15 * 60 * 1000);
      }
      if (now - lastTouch > 30_000) {
        lastTouch = now;
        fetch('/api/v1/auth/touch', { method: 'POST' }).catch(() => undefined);
      }
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, registerActivity, { passive: true }));
    registerActivity();
    return () => {
      events.forEach(event => window.removeEventListener(event, registerActivity));
      if (ownerTimer) clearTimeout(ownerTimer);
    };
  }, [authUser]);

  // Telegram Mini App & Online Buyurtmalar holati
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>(() => {
    const saved = localStorage.getItem('pb_beeline_online_orders_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [autoPrintOnlineOrders, setAutoPrintOnlineOrders] = useState<boolean>(() => {
    const saved = localStorage.getItem('pb_beeline_autoprint');
    return saved !== null ? saved === 'true' : true;
  });

  const [audioAlertOnlineOrders, setAudioAlertOnlineOrders] = useState<boolean>(() => {
    const saved = localStorage.getItem('pb_beeline_audioalert');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoPrintActiveReceipt, setAutoPrintActiveReceipt] = useState<boolean>(false);

  // Save online orders to localStorage
  useEffect(() => {
    localStorage.setItem('pb_beeline_online_orders_v1', JSON.stringify(onlineOrders));
  }, [onlineOrders]);

  // Load state from localStorage or initial data
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (saved) {
      try {
        const parsed: Product[] = JSON.parse(saved);
        return removeDemoProducts(parsed).map((p) => ({
          ...p,
          wholesalePrice: p.wholesalePrice || Math.round((p.sellingPrice * 0.82) / 1000) * 1000
        }));
      } catch (e) { console.error(e); }
    }
    return [];
  });

  const [storeInfo, setStoreInfo] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STORE_INFO);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          !parsed.address ||
          parsed.name === "BEELINE CENTR" ||
          parsed.name === "Paxtaobod Beeline Aksessuarlar Markazi" ||
          parsed.phone === "+998 90 600 00 20"
        ) {
          return STORE_INFO;
        }
        const { adminPin: _legacyPin, ...safeParsed } = parsed;
        return {
          ...STORE_INFO,
          ...safeParsed
        };
      } catch (e) { console.error(e); }
    }
    return STORE_INFO;
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    const initialProdCats = INITIAL_PRODUCTS.map((p) => p.category);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...initialProdCats]));
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
    if (saved) {
      try { return removeDemoMovements(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [debts, setDebts] = useState<DebtRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEBTS);
    if (saved) {
      try { return removeDemoDebts(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [supplierDebts, setSupplierDebts] = useState<SupplierDebtRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIER_DEBTS);
    if (saved) {
      try { return removeDemoSupplierDebts(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [customers, setCustomers] = useState<CustomerProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (saved) {
      try { return removeDemoCustomers(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return [];
  });

  // Sync with LocalStorage
  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products, authUser?.role]);

  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories, authUser?.role]);

  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  }, [movements, authUser?.role]);

  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
  }, [debts, authUser?.role]);

  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_DEBTS, JSON.stringify(supplierDebts));
  }, [supplierDebts, authUser?.role]);

  useEffect(() => {
    if (authUser?.role === 'worker') return;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers, authUser?.role]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STORE_INFO, JSON.stringify(storeInfo));
  }, [storeInfo]);

  // Ishchi kirganda shu qurilmada oldin saqlangan (rahbarga tegishli) ma'lumotlar o'chiriladi va ekranda qoldirilmaydi.
  useEffect(() => {
    if (authUser?.role !== 'worker') return;
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('pb_beeline_online_orders_v1');
    setProducts([]);
    setMovements([]);
    setDebts([]);
    setSupplierDebts([]);
    setCustomers([]);
  }, [authUser?.id, authUser?.role]);

  // Serverdan eng so'nggi ma'lumotlarni tortib olish (Pull latest live data from server)
  const fetchLatestStateFromServer = async () => {
    try {
      if (authUser?.role === 'owner' && !legacyHistoryImportedRef.current) {
        legacyHistoryImportedRef.current = true;
        if (movements.length || debts.length || supplierDebts.length) {
          await fetch('/api/v1/sync/import-legacy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movements, debts, supplierDebts })
          });
        }
      }
      const res = await fetch('/api/v1/sync');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.state) {
          applyingServerStateRef.current = true;
          const s = data.state;
          serverRevisionRef.current = data.serverTimestamp || s.lastUpdated || null;
          if (typeof data.apiKey === 'string') setApiKey(data.apiKey);
          const serverProducts = Array.isArray(s.products) ? removeDemoProducts(s.products) : [];
          setProducts(serverProducts);
          if (Array.isArray(s.categories)) setCategories(s.categories);
          if (Array.isArray(s.movements)) setMovements(s.movements);
          if (Array.isArray(s.debts)) {
            setDebts(s.debts);
          }
          if (Array.isArray(s.supplierDebts)) {
            setSupplierDebts(s.supplierDebts);
          }
          window.setTimeout(() => {
            applyingServerStateRef.current = false;
            serverSyncReadyRef.current = true;
          }, 0);
        }
      }
    } catch (err) {
      // Offline or network blip
    }
  };

  // Dastur yuklanganda va har 5 soniyada serverdan yangilanishlarni olish (Real vaqt rejimida telefon <-> kompyuter sinxronlash)
  useEffect(() => {
    if (!authUser) return;
    fetchLatestStateFromServer();

    const interval = setInterval(fetchLatestStateFromServer, 4000);
    const handleFocus = () => fetchLatestStateFromServer();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authUser?.id]);

  // Server REST API bilan ikki tomonlama sinxronizatsiya (Push changes to server)
  async function handleSyncWithServer(overrideProducts?: Product[]) {
    if (authUser?.role !== 'owner') return;
    setIsSyncingWithServer(true);
    try {
      const res = await fetch('/api/v1/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: overrideProducts || products,
          movements,
          debts,
          supplierDebts,
          categories,
          storeInfo,
          baseRevision: serverRevisionRef.current,
          clientTimestamp: new Date().toISOString()
        })
      });
      if (res.status === 409) {
        await fetchLatestStateFromServer();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        serverRevisionRef.current = data.serverTimestamp || data.state?.lastUpdated || serverRevisionRef.current;
        if (data.success && data.apiKey) {
          setApiKey(data.apiKey);
        }
      }
    } catch (err) {
      console.warn('[Sync] Server bilan ulanish kutilmoqda:', err);
    } finally {
      setIsSyncingWithServer(false);
    }
  }

  // Har safar foydalanuvchi tovar qo'shganda yoki o'zgartirganda darhol serverga yuborish (Debounce 500ms)
  useEffect(() => {
    if (!serverSyncReadyRef.current || applyingServerStateRef.current) return;
    const timer = setTimeout(() => {
      handleSyncWithServer();
    }, 500);
    return () => clearTimeout(timer);
  }, [products, categories, movements, debts, supplierDebts, storeInfo]);

  // Today's Key Metrics for Header
  const { todayRevenue, todayProfit } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayChiqim = movements.filter(
      (m) => m.type === 'chiqim' && m.timestamp.slice(0, 10) === todayStr
    );
    const todayVazvrat = movements.filter(
      (m) => m.type === 'vazvrat' && m.timestamp.slice(0, 10) === todayStr
    );

    const grossRevenue = todayChiqim.reduce((sum, m) => sum + m.totalRevenue, 0);
    const vazvratRevenue = todayVazvrat.reduce((sum, m) => sum + m.totalRevenue, 0);
    const revenue = Math.max(0, grossRevenue - vazvratRevenue);

    const grossProfit = todayChiqim.reduce((sum, m) => sum + m.profit, 0);
    const vazvratProfit = todayVazvrat.reduce((sum, m) => sum + m.profit, 0);
    const profit = grossProfit - vazvratProfit;

    return { todayRevenue: revenue, todayProfit: profit };
  }, [movements]);

  const activeDebtsCount = debts.filter((d) => d.status !== 'yopildi').length;
  const activeSupplierDebtsCount = supplierDebts.filter((d) => d.status !== 'yopildi').length;
  const outOfStockCount = useMemo(() => products.filter((p) => p.stock <= 0).length, [products]);

  // Online Orders metric
  const unprintedOrdersCount = useMemo(() => {
    return onlineOrders.filter((o) => !o.isPrinted).length;
  }, [onlineOrders]);

  // Fetch & Refresh Online Orders from Server
  const handleRefreshOnlineOrders = async () => {
    try {
      const res = await fetch('/api/v1/telegram/miniapp/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOnlineOrders((current) => mergeOnlineOrders(current, data.orders));
        }
      }
    } catch (e) {
      console.warn('Refresh online orders error:', e);
    }
  };

  // Print Order Receipt & mark printed
  const handlePrintOrderReceipt = (order: OnlineOrder) => {
    const receiptData: SaleReceiptData = {
      receiptNumber: order.receiptNumber,
      date: order.createdAt,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      paymentMethod: order.paymentMethod,
      items: order.items.map((it) => ({
        id: it.productId,
        name: it.productName,
        category: it.category,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.totalPrice
      })),
      subtotal: order.subtotal || order.totalAmount,
      discount: 0,
      total: order.totalAmount,
      paidAmount: order.totalAmount,
      cashierName: `Telegram Mini App (${order.customerName})`,
      notes: `Online Zakaz #${order.orderNumber} | Tel: ${order.customerPhone} | Manzil: ${order.customerAddress || 'Olib ketish'}`
    };

    setAutoPrintActiveReceipt(true);
    setActiveReceiptToPrint(receiptData);

    fetch(`/api/v1/telegram/miniapp/orders/${order.id}/mark-printed`, {
      method: 'POST'
    }).catch((err) => console.warn(err));

    setOnlineOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, isPrinted: true, status: 'chiqarildi' } : o
      )
    );
  };

  // Update order status (e.g. yangi -> chiqarildi -> yetkazilmoqda -> bajarildi)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OnlineOrderStatus) => {
    try {
      const res = await fetch(`/api/v1/telegram/miniapp/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOnlineOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Automated background polling for incoming Telegram Mini App orders
  useEffect(() => {
    let isSubscribed = true;

    const pollPendingOrders = async () => {
      try {
        const res = await fetch('/api/v1/telegram/miniapp/pending-orders');
        if (!res.ok) return;
        const data = await res.json();
        if (!isSubscribed || !Array.isArray(data.orders)) return;

        const pendingList: OnlineOrder[] = data.orders;

        if (pendingList.length > 0) {
          // 1. Play cash register chime sound
          if (audioAlertOnlineOrders) {
            playCashRegisterChime();
          }

          // 2. Trigger receipt modal with autoPrint
          if (autoPrintOnlineOrders) {
            const newest = pendingList[0];
            const receiptData: SaleReceiptData = {
              receiptNumber: newest.receiptNumber,
              date: newest.createdAt,
              customerName: newest.customerName,
              customerPhone: newest.customerPhone,
              customerAddress: newest.customerAddress,
              paymentMethod: newest.paymentMethod,
              items: newest.items.map((it) => ({
                id: it.productId,
                name: it.productName,
                category: it.category,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                total: it.totalPrice
              })),
              subtotal: newest.subtotal || newest.totalAmount,
              discount: 0,
              total: newest.totalAmount,
              paidAmount: newest.totalAmount,
              cashierName: `Telegram Mini App (${newest.customerName})`,
              notes: `Online Zakaz #${newest.orderNumber} | Tel: ${newest.customerPhone} | Manzil: ${newest.customerAddress || 'Olib ketish'}`
            };

            setAutoPrintActiveReceipt(true);
            setActiveReceiptToPrint(receiptData);

            // Mark as printed on server
            fetch(`/api/v1/telegram/miniapp/orders/${newest.id}/mark-printed`, {
              method: 'POST'
            }).catch((err) => console.warn('Failed to mark order printed:', err));
          }

          // 3. Refresh orders & products list so POS inventory and movements are immediately updated
          handleRefreshOnlineOrders();
          fetch('/api/v1/telegram/miniapp/products', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => {
              if (d.products && Array.isArray(d.products)) {
                setProducts(d.products);
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        // Network blip, will retry next cycle
      }
    };

    // Initial check
    pollPendingOrders();

    // Poll every 3.5 seconds
    const interval = setInterval(pollPendingOrders, 3500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [autoPrintOnlineOrders, audioAlertOnlineOrders]);

  // Handle Kirim (Incoming stock)
  const handleConfirmKirim = (
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
  ) => {
    const nowISO = new Date().toISOString();
    const newMovements: StockMovement[] = [];

    setProducts((prevProducts) => {
      let updated = [...prevProducts];

      items.forEach((item) => {
        const prodIndex = updated.findIndex((p) => p.id === item.product.id);
        if (prodIndex !== -1) {
          const current = updated[prodIndex];
          updated[prodIndex] = {
            ...current,
            stock: current.stock + item.quantity,
            purchasePrice: item.unitCost,
            wholesalePrice: item.wholesalePrice !== undefined 
              ? item.wholesalePrice 
              : current.wholesalePrice || Math.round(item.unitPrice * 0.8),
            sellingPrice: item.unitPrice
          };
        } else {
          updated.push({
            ...item.product,
            stock: item.quantity,
            purchasePrice: item.unitCost,
            wholesalePrice: item.wholesalePrice !== undefined
              ? item.wholesalePrice
              : item.product.wholesalePrice || Math.round(item.unitPrice * 0.8),
            sellingPrice: item.unitPrice
          });
        }

        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'kirim',
          productId: item.product.id,
          productName: item.product.name,
          category: item.product.category,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
          totalCost: item.unitCost * item.quantity,
          totalRevenue: item.unitCost * item.quantity,
          profit: 0,
          timestamp: nowISO,
          counterparty: supplier,
          notes: supplierDebtInfo?.isDebt 
            ? `${notes ? notes + ' | ' : ''}Qarzga olindi (Qoldiq: ${supplierDebtInfo.remainingAmount.toLocaleString('uz-UZ')} so'm)` 
            : notes
        });
      });

      return updated;
    });

    setMovements((prev) => [...newMovements, ...prev]);

    // Automatically record into Supplier Debts if purchased on credit / partial credit
    if (supplierDebtInfo && supplierDebtInfo.isDebt && supplierDebtInfo.remainingAmount > 0) {
      const prodSummary = items.map((i) => `${i.product.name} (${i.quantity} ta)`).join(', ');
      const totalBatchCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

      const newSuppDebt: SupplierDebtRecord = {
        id: `supp-debt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        supplierName: supplier.trim() || 'Ulgurji Ta\'minotchi',
        supplierPhone: supplierDebtInfo.supplierPhone,
        productSummary: prodSummary,
        totalDebt: totalBatchCost,
        paidAmount: supplierDebtInfo.paidAmount,
        remainingAmount: supplierDebtInfo.remainingAmount,
        dueDate: supplierDebtInfo.dueDate,
        createdAt: nowISO,
        status: supplierDebtInfo.paidAmount > 0 ? 'qisman_tolandi' : 'faol',
        notes: notes ? `${notes} (Tovar kirimi orqali olindi)` : 'Tovar kirimi orqali partiya olindi',
        paymentHistory: supplierDebtInfo.paidAmount > 0 ? [
          {
            id: `spay-${Date.now()}`,
            date: nowISO,
            amount: supplierDebtInfo.paidAmount,
            method: 'naqd',
            notes: 'Tovar qabulida berilgan avans'
          }
        ] : []
      };

      setSupplierDebts((prev) => [newSuppDebt, ...prev]);
    }
  };

  // Print receipt helper for any movement
  const handlePrintMovementReceipt = (m: StockMovement) => {
    const relatedMovements = m.batchSaleId
      ? movements.filter((mov) => mov.batchSaleId === m.batchSaleId)
      : [m];

    const totalRev = relatedMovements.reduce((sum, item) => sum + item.totalRevenue, 0);
    const isReturn = m.type === 'vazvrat' || m.isReturn === true;

    const receipt: SaleReceiptData = {
      receiptNumber: m.receiptNumber || (isReturn ? `VZV-${m.id.slice(-6)}` : `PB-${m.id.slice(-6)}`),
      date: m.timestamp,
      customerName: m.counterparty || (isReturn ? 'Mijoz (Vazvrat)' : 'Do\'kon mijozi'),
      customerPhone: m.customerPhone,
      customerAddress: m.customerAddress || 'Do\'kondan (Paxtaobod)',
      paymentMethod: m.paymentMethod || 'naqd',
      items: relatedMovements.map((item) => ({
        id: item.productId,
        name: item.productName,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalRevenue
      })),
      subtotal: totalRev + relatedMovements.reduce((sum, row) => sum + (row.discountAmount || 0), 0),
      total: totalRev,
      notes: m.notes,
      cashierName: 'Sayfullo (Hisobchi)',
      isReturn: isReturn,
      returnReason: m.returnReason,
      ...(!isReturn && m.type === 'chiqim' ? movementPaymentSummary(m, relatedMovements, debts) : {})
    };

    setActiveReceiptToPrint(receipt);
  };

  // Handle Chiqim (Sales / Outgoing stock)
  const handleConfirmChiqim = (
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
  ) => {
    const nowISO = new Date().toISOString();
    const newMovements: StockMovement[] = [];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const accounting = saleAccounting(items.map(item => item.quantity * item.unitPrice), debtDetails?.paidNow ?? (paymentMethod === 'nasiya' ? 0 : subtotal), debtDetails?.discountAmount);
    const saleTotalRevenue = accounting.total;
    const previousCustomerDebt = customerDebtTotal(debts, customerName);
    const batchId = `batch-${Date.now()}`;
    const receiptNum = debtDetails?.receiptNumber || `PB-${nowISO.slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    if (authUser?.role === 'worker') {
      fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.unitPrice })),
          paymentMethod,
          customerName,
          customerPhone,
          customerAddress,
          notes,
          dueDate: debtDetails?.dueDate,
          discount: debtDetails?.discountAmount
        })
      }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Savdo saqlanmadi.');
        await fetchLatestStateFromServer();
      }).catch(error => {
        window.alert(error instanceof Error ? error.message : 'Savdo serverga saqlanmadi.');
      });
    }

    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        const soldItem = items.find((i) => i.product.id === p.id);
        if (soldItem) {
          return {
            ...p,
            stock: Math.max(0, p.stock - soldItem.quantity)
          };
        }
        return p;
      });
    });

    items.forEach((item, index) => {
      const line = accounting.lines[index];
      const totalRev = line.revenue;
      const totalCost = item.quantity * item.product.purchasePrice;
      const profit = totalRev - totalCost;

      newMovements.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'chiqim',
        productId: item.product.id,
        productName: item.product.name,
        category: item.product.category,
        quantity: item.quantity,
        unitCost: item.product.purchasePrice,
        unitPrice: item.unitPrice,
        totalCost,
        totalRevenue: totalRev,
        discountAmount: line.discount,
        paidAmount: line.paid,
        debtRemaining: line.debt,
        previousCustomerDebt,
        customerTotalDebt: previousCustomerDebt + accounting.remaining,
        debtDueDate: accounting.remaining > 0 ? debtDetails?.dueDate : undefined,
        profit,
        timestamp: nowISO,
        paymentMethod,
        counterparty: customerName,
        customerPhone,
        customerAddress,
        receiptNumber: receiptNum,
        batchSaleId: batchId,
        notes
      });
    });

    setMovements((prev) => [...newMovements, ...prev]);

    // Automatically remember and update Customer Profile
    if (customerName && customerName.trim() !== "Do'kon mijozi") {
      const cleanName = customerName.trim();
      setCustomers((prevCustomers) => {
        const existingIndex = prevCustomers.findIndex(
          (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
        );

        if (existingIndex !== -1) {
          const updated = [...prevCustomers];
          updated[existingIndex] = {
            ...updated[existingIndex],
            phone: customerPhone && customerPhone.trim() !== '+998' ? customerPhone : updated[existingIndex].phone,
            address: customerAddress || updated[existingIndex].address,
            lastVisit: nowISO
          };
          return updated;
        } else {
          const newCust: CustomerProfile = {
            id: `cust-${Date.now()}`,
            name: cleanName,
            phone: customerPhone && customerPhone.trim() !== '+998' ? customerPhone : '+998 ',
            address: customerAddress || 'Paxtaobod',
            notes: `Oxirgi xarid: ${items.map((i) => i.product.name).join(', ')}`,
            createdAt: nowISO,
            lastVisit: nowISO
          };
          return [newCust, ...prevCustomers];
        }
      });
    }

    // If Nasiya (Debt) or partial payment left as debt
    if (accounting.remaining > 0 && debtDetails) {
      const remaining = accounting.remaining;
      if (remaining > 0) {
        const newDebt: DebtRecord = {
          id: `debt-${Date.now()}`,
          movementId: newMovements[0]?.id,
          customerName,
          customerPhone: customerPhone || '+998',
          totalDebt: saleTotalRevenue,
          paidAmount: accounting.paid,
          remainingAmount: remaining,
          dueDate: debtDetails.dueDate,
          createdAt: nowISO,
          status: accounting.paid > 0 ? 'qisman_tolandi' : 'faol',
          notes: items.map((i) => `${i.product.name} (${i.quantity} ta)`).join(', '),
          paymentHistory: accounting.paid > 0 ? [
            {
              date: nowISO,
              amount: accounting.paid,
              method: 'naqd'
            }
          ] : []
        };

        setDebts((prev) => [newDebt, ...prev]);
      }
    }
  };

  // Open Vazvrat Modal (Optionally pre-filled with an existing movement / sale)
  const handleOpenVazvratModal = (movement?: StockMovement) => {
    if (authUser?.role === 'worker') {
      setIsWorkerReturnOpen(true);
      return;
    }
    setVazvratInitialMovement(movement);
    setIsVazvratModalOpen(true);
  };

  // Confirm Vazvrat (Returned Goods)
  const handleConfirmVazvrat = (data: {
    productId: string;
    productName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    totalRefund: number;
    paymentMethod: PaymentMethod;
    customerName: string;
    customerPhone: string;
    returnReason: string;
    notes: string;
    restoreStock: boolean;
    printReceipt: boolean;
    originalMovementId?: string;
    originalReceiptNumber?: string;
  }) => {
    const nowISO = new Date().toISOString();
    const batchId = `vazvrat-batch-${Date.now()}`;
    const receiptNum = `VZV-${Date.now().toString().slice(-6)}`;

    // 1. If restoreStock is true, increase product stock in products state
    if (data.restoreStock) {
      setProducts((prevProducts) => {
        return prevProducts.map((p) => {
          if (p.id === data.productId) {
            return {
              ...p,
              stock: p.stock + data.quantity
            };
          }
          return p;
        });
      });
    }

    // 2. Create StockMovement entry with type: 'vazvrat'
    const totalCost = data.unitCost * data.quantity;
    const profit = data.totalRefund - totalCost;

    const newMovement: StockMovement = {
      id: `vazvrat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: data.productId,
      productName: data.productName,
      category: data.category,
      type: 'vazvrat',
      quantity: data.quantity,
      unitCost: data.unitCost,
      unitPrice: data.unitPrice,
      totalCost: totalCost,
      totalRevenue: data.totalRefund,
      profit: profit,
      counterparty: data.customerName.trim() || 'Mijoz (Vazvrat)',
      customerPhone: data.customerPhone.trim() || undefined,
      customerAddress: 'Do\'kondan qaytarildi (Paxtaobod)',
      paymentMethod: data.paymentMethod,
      timestamp: nowISO,
      notes: data.notes ? `${data.notes} (Sabab: ${data.returnReason})` : `Vazvrat sababi: ${data.returnReason}`,
      receiptNumber: receiptNum,
      batchSaleId: batchId,
      isReturn: true,
      returnReason: data.returnReason,
      originalMovementId: data.originalMovementId
    };

    setMovements((prev) => [newMovement, ...prev]);

    // 3. If refundMethod is 'nasiya', adjust customer debt
    if (data.paymentMethod === 'nasiya') {
      const totalRefundSum = data.totalRefund;
      setDebts((prevDebts) => {
        let remainingRefundToDeduct = totalRefundSum;
        return prevDebts.map((debt) => {
          if (remainingRefundToDeduct <= 0) return debt;
          const isSameCustomer = 
            (debt.customerName.toLowerCase().trim() === data.customerName.toLowerCase().trim()) ||
            (data.customerPhone && debt.customerPhone === data.customerPhone);
          
          if (isSameCustomer && debt.status !== 'yopildi' && debt.remainingAmount > 0) {
            const deduction = Math.min(debt.remainingAmount, remainingRefundToDeduct);
            remainingRefundToDeduct -= deduction;
            const newRemaining = debt.remainingAmount - deduction;
            const newPaid = debt.paidAmount + deduction;
            return {
              ...debt,
              paidAmount: newPaid,
              remainingAmount: newRemaining,
              status: newRemaining <= 0 ? 'yopildi' : 'qisman_tolandi',
              notes: `${debt.notes ? debt.notes + ' | ' : ''}Vazvrat hisobiga ${deduction.toLocaleString('uz-UZ')} so'm kamaytirildi`,
              paymentHistory: [
                ...debt.paymentHistory,
                {
                  date: nowISO,
                  amount: deduction,
                  method: 'naqd'
                }
              ]
            };
          }
          return debt;
        });
      });
    }

    // 4. Open Return Receipt if requested
    if (data.printReceipt) {
      const returnReceipt: SaleReceiptData = {
        receiptNumber: receiptNum,
        date: nowISO,
        customerName: data.customerName.trim() || 'Mijoz',
        customerPhone: data.customerPhone.trim() || undefined,
        customerAddress: 'Paxtaobod Beeline',
        paymentMethod: data.paymentMethod,
        items: [
          {
            id: data.productId,
            name: data.productName,
            category: data.category,
            quantity: data.quantity,
            unitPrice: data.unitPrice,
            total: data.totalRefund
          }
        ],
        subtotal: data.totalRefund,
        total: data.totalRefund,
        notes: `Vazvrat: ${data.returnReason}${data.notes ? ` | ${data.notes}` : ''}`,
        cashierName: 'Sayfullo (Hisobchi)',
        isReturn: true,
        returnReason: data.returnReason
      };

      setActiveReceiptToPrint(returnReceipt);
    }
  };

  // Add new product directly
  const handleAddNewProductDirect = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
  };

  // Update product in warehouse
  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Delete product
  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Clear products with zero stock
  const handleClearZeroStockProducts = () => {
    setProducts((prev) => prev.filter((p) => p.stock > 0));
  };

  // Quick Kirim for a product from stock table
  const handleQuickKirimForProduct = (product: Product) => {
    const qty = prompt(`"${product.name}" uchun qabul qilingan miqdorni kiriting (dona):`, '10');
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;

    handleConfirmKirim(
      [
        {
          product,
          quantity: Number(qty),
          unitCost: product.purchasePrice,
          unitPrice: product.sellingPrice
        }
      ],
      'Baza / Tezkor Kirim',
      'Omborxona jadvalidan tezkor kirim qilindi'
    );
  };

  // Bulk Excel / CSV Import handler
  const handleExecuteExcelImport = (
    items: {
      product: Product;
      isNew: boolean;
      addedStock: number;
    }[],
    createKirimRecord: boolean,
    supplierName: string,
    notes: string
  ) => {
    try {
      const nowISO = new Date().toISOString();
      const newMovements: StockMovement[] = [];
      const batchId = `excel-batch-${Date.now()}`;
      const safeSupplier = String(supplierName || 'Ommaviy Kirim (Excel)').trim();
      const safeNotes = String(notes || 'Excel / CSV orqali ommaviy yuklandi').trim();

      // 1. Update Products list
      setProducts((prevProducts) => {
        const updated = [...prevProducts];

        items.forEach((item, index) => {
          if (!item || !item.product) return;
          const cleanProduct: Product = {
            id: item.product.id || `prod-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
            name: String(item.product.name || 'Nomsiz tovar').trim(),
            category: String(item.product.category || 'Aksessuarlar').trim(),
            brand: String(item.product.brand || 'Universal').trim(),
            barcode: String(item.product.barcode || `${Math.floor(100000 + Math.random() * 900000)}`).trim(),
            purchasePrice: Math.max(0, Number(item.product.purchasePrice) || 0),
            sellingPrice: Math.max(0, Number(item.product.sellingPrice) || 0),
            wholesalePrice: Math.max(0, Number(item.product.wholesalePrice) || Math.round((Number(item.product.sellingPrice) || 0) * 0.85)),
            stock: Math.max(0, Number(item.product.stock) || 0),
            minStockAlert: Math.max(1, Number(item.product.minStockAlert) || 5)
          };

          const idx = updated.findIndex((p) => p.id === cleanProduct.id);
          if (idx !== -1) {
            updated[idx] = cleanProduct;
          } else {
            updated.unshift(cleanProduct);
          }

          // 2. Prepare Kirim StockMovement if requested and addedStock > 0
          const addedQty = Number(item.addedStock) || 0;
          if (createKirimRecord && addedQty > 0) {
            const cost = cleanProduct.purchasePrice;
            const price = cleanProduct.sellingPrice;
            newMovements.push({
              id: `mov-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
              type: 'kirim',
              productId: cleanProduct.id,
              productName: cleanProduct.name,
              category: cleanProduct.category,
              quantity: addedQty,
              unitCost: cost,
              unitPrice: price,
              totalCost: cost * addedQty,
              totalRevenue: cost * addedQty,
              profit: 0,
              timestamp: nowISO,
              counterparty: safeSupplier,
              batchSaleId: batchId,
              notes: safeNotes ? `${safeNotes} (Excel ommaviy kirim)` : 'Excel / CSV orqali ommaviy yuklandi'
            });
          }
        });

        return updated;
      });

      // 3. Add to movements if kirim records were created
      if (newMovements.length > 0) {
        setMovements((prev) => [...newMovements, ...prev]);
      }

      // 4. Also register any new categories from the imported products
      const importedCategories = items
        .map((i) => i.product?.category?.trim())
        .filter((c): c is string => Boolean(c));
      if (importedCategories.length > 0) {
        setCategories((prevCats) => {
          const set = new Set([...prevCats, ...importedCategories]);
          return Array.from(set);
        });
      }
    } catch (err) {
      console.error('Failed to execute excel import:', err);
    }
  };

  // Debt payment handling
  const handleAddDebtPayment = (
    debtId: string,
    amount: number,
    method: 'naqd' | 'click_payme'
  ) => {
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id === debtId) {
          const accepted = clampDebtPayment(d, amount);
          if (accepted <= 0) return d;
          const newPaid = d.paidAmount + accepted;
          const newRemaining = Math.max(0, d.totalDebt - newPaid);
          const history = d.paymentHistory || [];
          return {
            ...d,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newRemaining === 0 ? 'yopildi' : 'qisman_tolandi',
            paymentHistory: [
              ...history,
              {
                date: new Date().toISOString(),
                amount: accepted,
                method
              }
            ]
          };
        }
        return d;
      })
    );
  };

  const handleAddNewDebtManual = (newDebt: DebtRecord) => {
    setDebts((prev) => [newDebt, ...prev]);
  };

  // Supplier Debts Handlers
  const handleAddSupplierDebtPayment = (
    debtId: string,
    amount: number,
    method: 'naqd' | 'karta' | 'hisob_raqam',
    notes?: string
  ) => {
    const nowISO = new Date().toISOString();
    setSupplierDebts((prev) =>
      prev.map((d) => {
        if (d.id === debtId) {
          const newPaid = d.paidAmount + amount;
          const newRemaining = Math.max(0, d.totalDebt - newPaid);
          const history = d.paymentHistory || [];
          return {
            ...d,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newRemaining === 0 ? 'yopildi' : 'qisman_tolandi',
            paymentHistory: [
              ...history,
              {
                id: `spay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                date: nowISO,
                amount,
                method,
                notes
              }
            ]
          };
        }
        return d;
      })
    );
  };

  const handleAddNewSupplierDebt = (
    newDebtData: Omit<SupplierDebtRecord, 'id' | 'createdAt' | 'status' | 'paymentHistory'>
  ) => {
    const nowISO = new Date().toISOString();
    const remaining = Math.max(0, newDebtData.totalDebt - (newDebtData.paidAmount || 0));
    const newRecord: SupplierDebtRecord = {
      ...newDebtData,
      id: `supp-debt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: nowISO,
      remainingAmount: remaining,
      status: remaining === 0 ? 'yopildi' : (newDebtData.paidAmount > 0 ? 'qisman_tolandi' : 'faol'),
      paymentHistory: newDebtData.paidAmount > 0 ? [
        {
          id: `spay-${Date.now()}`,
          date: nowISO,
          amount: newDebtData.paidAmount,
          method: 'naqd',
          notes: 'Dastlabki to\'lov'
        }
      ] : []
    };

    setSupplierDebts((prev) => [newRecord, ...prev]);
  };

  const handleUpdateSupplierDebt = (updatedDebt: SupplierDebtRecord) => {
    setSupplierDebts((prev) =>
      prev.map((d) => (d.id === updatedDebt.id ? updatedDebt : d))
    );
  };

  const handleDeleteSupplierDebt = (debtId: string) => {
    if (confirm("Ushbu ta'minotchi qarz yozuvini o'chirmoqchimisiz?")) {
      setSupplierDebts((prev) => prev.filter((d) => d.id !== debtId));
    }
  };

  // Store settings update
  const handleUpdateStoreInfo = (newInfo: StoreSettings) => {
    setStoreInfo(newInfo);
  };

  // Bulk update prices across inventory
  const handleBatchUpdatePrices = (
    category: string,
    percentChange: number,
    target: 'sellingPrice' | 'wholesalePrice'
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (category !== 'all' && p.category !== category) return p;
        const currentVal = p[target] || p.sellingPrice;
        const newVal = Math.max(0, Math.round((currentVal * (1 + percentChange / 100)) / 500) * 500);
        return {
          ...p,
          [target]: newVal
        };
      })
    );
  };

  // Single product price update from table
  const handleUpdateSingleProductPrices = (
    productId: string,
    costPrice: number,
    wholesalePrice: number,
    sellingPrice: number
  ) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              costPrice,
              wholesalePrice,
              sellingPrice
            }
          : p
      )
    );
  };

  // Category Management Handlers
  const handleAddCategory = (newCat: string): boolean => {
    const trimmed = newCat.trim();
    if (!trimmed) return false;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    setCategories((prev) => [...prev, trimmed]);
    return true;
  };

  const handleEditCategory = (oldCat: string, newCat: string): boolean => {
    const trimmed = newCat.trim();
    if (!trimmed) return false;
    if (
      trimmed.toLowerCase() !== oldCat.toLowerCase() &&
      categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      return false;
    }

    setCategories((prev) => prev.map((c) => (c === oldCat ? trimmed : c)));
    // Also update all products assigned to oldCat
    setProducts((prev) =>
      prev.map((p) => (p.category === oldCat ? { ...p, category: trimmed } : p))
    );
    // Also update all movement logs
    setMovements((prev) =>
      prev.map((m) => (m.category === oldCat ? { ...m, category: trimmed } : m))
    );
    return true;
  };

  const handleDeleteCategory = (catToDelete: string): boolean => {
    setCategories((prev) => prev.filter((c) => c !== catToDelete));
    // Reassign products to standard fallback if needed
    setProducts((prev) =>
      prev.map((p) =>
        p.category === catToDelete ? { ...p, category: 'Aksessuarlar' } : p
      )
    );
    return true;
  };

  const handleRequireAdminPin = (targetTab?: AccountingTab) => {
    setPendingTab(targetTab || null);
    window.alert("Rahbar bo'limiga kirish uchun kassir hisobidan chiqing va Rahbar foydalanuvchisini tanlang.");
  };

  const handleAdminUnlockSuccess = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleAdminLock = () => {
    fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuthUser(null);
    const protectedTabs: AccountingTab[] = ['report', 'supplier-debts', 'hisobchi'];
    if (protectedTabs.includes(activeTab)) {
      setActiveTab('chiqim');
    }
  };

  // Check if opened as standalone Telegram Mini App (e.g. from Telegram Web App button)
  const isMiniAppRoute = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('view') === 'miniapp' ||
    window.location.pathname === '/miniapp'
  );

  if (isMiniAppRoute) {
    return (
      <TelegramMiniAppView
        products={products}
        isStandalone={true}
        onOrderPlaced={() => {
          handleRefreshOnlineOrders();
        }}
      />
    );
  }

  if (isAuthLoading) {
    return <div className="min-h-screen bg-stone-950 text-stone-300 flex items-center justify-center text-sm font-bold">CRM yuklanmoqda…</div>;
  }

  if (!authUser) {
    return <LoginScreen onLogin={(user) => {
      setAuthUser(user);
      setActiveTab(user.role === 'owner' ? 'report' : 'chiqim');
    }} />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col lg:flex-row">
      {/* Left Column Sidebar (Chap tarafdagi vertikal ustun) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDebtsCount={activeDebtsCount}
        activeSupplierDebtsCount={activeSupplierDebtsCount}
        outOfStockCount={outOfStockCount}
        unprintedOrdersCount={unprintedOrdersCount}
        storeInfo={storeInfo}
        isAdminUnlocked={isAdminUnlocked}
        onLockAdmin={handleAdminLock}
        onOpenVazvrat={() => handleOpenVazvratModal()}
        onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
        onOpenPdfReports={handleOpenPdfReports}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenPhotoKirim={() => setIsPhotoKirimModalOpen(true)}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsedPersist(true)}
      />
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={() => setSidebarCollapsedPersist(false)}
          title="Menyuni ochish"
          className="no-print hidden lg:flex fixed top-3 left-3 z-50 w-10 h-10 items-center justify-center rounded-xl bg-stone-950 text-white shadow-lg hover:bg-stone-800"
        >
          <span className="text-xl leading-none">☰</span>
        </button>
      )}

      {/* Right Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Sleek Top Bar */}
        <TopNavbar
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          todayRevenue={todayRevenue}
          outOfStockCount={outOfStockCount}
          isAdminUnlocked={isAdminUnlocked}
          onLockAdmin={handleAdminLock}
          onOpenPdfReports={handleOpenPdfReports}
          onOpenPhotoKirim={() => setIsPhotoKirimModalOpen(true)}
        />

        {/* Main Container */}
        <main className={`flex-1 w-full mx-auto px-2.5 sm:px-6 pt-3 sm:pt-6 pb-28 lg:pb-12 overflow-x-clip ${activeTab === 'chiqim' ? 'max-w-[1700px]' : 'max-w-7xl'}`}>
        {activeTab === 'report' && (
          !isAdminUnlocked ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-600 border border-amber-400/40 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900">Kunlik Foyda va Hisobot Himoyalangan</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Ushbu bo'lim faqat do'kon rahbari uchun mo'ljallangan. Sof foyda, sof tushum va to'liq hisobotlarni ko'rish uchun 4 xonali PIN-kodni kiriting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRequireAdminPin('report')}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-sm shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>PIN-kodni kiritish</span>
              </button>
            </div>
          ) : (
            <ReportsDashboard onOpenPdfReports={handleOpenPdfReports} />
          )
        )}

        {activeTab === 'kirim' && (
          <KirimFormView
            products={products}
            categories={categories}
            recentKirimMovements={movements.filter((m) => m.type === 'kirim')}
            onConfirmKirim={handleConfirmKirim}
            onAddNewProductDirect={handleAddNewProductDirect}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onNavigateToSupplierDebts={() => setActiveTab('supplier-debts')}
            onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
            onOpenPhotoKirim={() => setIsPhotoKirimModalOpen(true)}
          />
        )}

        {activeTab === 'chiqim' && (
          <>
            <ChiqimFormView
              presetCustomer={presetCustomer}
              topSlot={
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3 items-start">
            <CashExpensePanel
              user={authUser}
              cashRevenue={movements.filter(m => m.type === 'chiqim' && m.paymentMethod === 'naqd' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(m.timestamp)) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())).reduce((sum, m) => sum + m.totalRevenue, 0)}
            />
            <CashShiftPanel user={authUser} />
            </div>
              }
              products={products}
              recentChiqimMovements={movements.filter((m) => m.type === 'chiqim')}
              customers={customers}
              debts={debts}
              onConfirmChiqim={handleConfirmChiqim}
              onPrintReceipt={handlePrintMovementReceipt}
              onQuickPayPastDebt={handleAddDebtPayment}
            />

          </>
        )}

        {activeTab === 'customers' && (
          <CustomersPanel
            isOwner={authUser?.role === 'owner'}
            localCustomers={authUser?.role === 'owner' ? customers : []}
            onPick={(customer) => {
              setPresetCustomer({ name: customer.name, phone: customer.phone, address: customer.address, nonce: Date.now() });
              setActiveTab('chiqim');
            }}
          />
        )}

        {activeTab === 'journal' && (
          <MovementJournalView
            movements={movements}
            isAdminUnlocked={isAdminUnlocked}
            onRequireUnlock={() => handleRequireAdminPin()}
            onPrintReceipt={handlePrintMovementReceipt}
            onOpenVazvrat={(movement) => handleOpenVazvratModal(movement)}
          />
        )}

        {activeTab === 'stock' && (
          <StockBalanceView
            products={products}
            categories={categories}
            isAdminUnlocked={isAdminUnlocked}
            onRequireUnlock={() => handleRequireAdminPin()}
            onAddProduct={handleAddNewProductDirect}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onQuickKirimForProduct={handleQuickKirimForProduct}
            onClearZeroStockProducts={handleClearZeroStockProducts}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
            onOpenPdfReports={handleOpenPdfReports}
            onNavigateToAiAnalyst={() => setActiveTab('ai-analyst')}
          />
        )}

        {activeTab === 'debts' && !isAdminUnlocked && (
          <WorkerDebtPanel onChanged={fetchLatestStateFromServer} />
        )}

        {activeTab === 'debts' && isAdminUnlocked && (
          <DebtsView
            debts={debts}
            movements={movements}
            storeInfo={storeInfo}
            onAddDebtPayment={handleAddDebtPayment}
            onAddNewDebt={handleAddNewDebtManual}
          />
        )}

        {activeTab === 'supplier-debts' && (
          !isAdminUnlocked ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-700 border border-amber-500/40 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900">Ta'minotchi Qarzlari Himoyalangan</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Ta'minotchilarga bo'lgan qarzlar va to'lovlar jurnali faqat do'kon rahbari uchun ochiq.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRequireAdminPin('supplier-debts')}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-amber-400 font-black rounded-xl text-sm shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>PIN-kodni kiritish</span>
              </button>
            </div>
          ) : (
            <SupplierDebtsView
              supplierDebts={supplierDebts}
              onAddSupplierDebtPayment={handleAddSupplierDebtPayment}
              onAddNewSupplierDebt={handleAddNewSupplierDebt}
              onUpdateSupplierDebt={handleUpdateSupplierDebt}
              onDeleteSupplierDebt={handleDeleteSupplierDebt}
              onNavigateToKirim={() => setActiveTab('kirim')}
            />
          )
        )}

        {activeTab === 'hisobchi' && (
          !isAdminUnlocked ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-600 border border-amber-400/40 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900">Hisobchi va Tizim Sozlamalari Himoyalangan</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Ushbu bo'lim faqat do'kon rahbari uchun mo'ljallangan. Buxgalteriya va narxlarni boshqarish uchun PIN-kodni kiriting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRequireAdminPin('hisobchi')}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-sm shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>PIN-kodni kiritish</span>
              </button>
            </div>
          ) : (
            <>
              <WorkerManagement />
              <HisobchiPanelView
                products={products}
                movements={movements}
                debts={debts}
                supplierDebts={supplierDebts}
                storeInfo={storeInfo}
                onUpdateStoreInfo={handleUpdateStoreInfo}
                onBatchUpdatePrices={handleBatchUpdatePrices}
                onUpdateSingleProductPrices={handleUpdateSingleProductPrices}
              />
            </>
          )
        )}

        {activeTab === 'ai-analyst' && (
          !isAdminUnlocked ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-600 border border-amber-400/40 flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900">AI Tahlilchi & Xarid Maslahatchisi Himoyalangan</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Savdo tahlillari, xatolar diagnostikasi, zakaz tavsiyalari va Telegram bot sozlamalari do'kon rahbari uchun himoyalangan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRequireAdminPin('ai-analyst')}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-sm shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>PIN-kodni kiritish</span>
              </button>
            </div>
          ) : (
            <AiAnalystView
              products={products}
              movements={movements}
              debts={debts}
              storeInfo={storeInfo}
              apiKey={apiKey}
            />
          )
        )}

        {activeTab === 'telegram-orders' && (
          <TelegramOrdersManagementView
            orders={onlineOrders}
            products={products}
            storeInfo={storeInfo}
            autoPrintEnabled={autoPrintOnlineOrders}
            onToggleAutoPrint={(enabled) => {
              setAutoPrintOnlineOrders(enabled);
              localStorage.setItem('pb_beeline_autoprint', String(enabled));
            }}
            audioAlertEnabled={audioAlertOnlineOrders}
            onToggleAudioAlert={(enabled) => {
              setAudioAlertOnlineOrders(enabled);
              localStorage.setItem('pb_beeline_audioalert', String(enabled));
            }}
            onPrintOrderReceipt={handlePrintOrderReceipt}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onRefreshOrders={handleRefreshOnlineOrders}
          />
        )}
      </main>

      {/* Global Printable Receipt Modal */}
      {activeReceiptToPrint && (
        <PrintReceiptModal
          receipt={activeReceiptToPrint}
          storeInfo={storeInfo}
          autoPrint={autoPrintActiveReceipt}
          onClose={() => {
            setActiveReceiptToPrint(null);
            setAutoPrintActiveReceipt(false);
          }}
        />
      )}

      {/* Desktop App Install & Instructions Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Ishchi uchun serverga yoziladigan tovar qaytarish */}
      <WorkerReturnModal
        isOpen={isWorkerReturnOpen && authUser?.role === 'worker'}
        onClose={() => setIsWorkerReturnOpen(false)}
        cashierName={authUser?.name || 'Kassir'}
        onDone={(receipt) => {
          fetchLatestStateFromServer();
          if (receipt) setActiveReceiptToPrint(receipt);
        }}
      />

      {/* Vazvrat Modal (Mijozdan tovar qaytarish) */}
      <VazvratModal
        isOpen={isVazvratModalOpen}
        onClose={() => {
          setIsVazvratModalOpen(false);
          setVazvratInitialMovement(undefined);
        }}
        products={products}
        debts={debts}
        prefillMovement={vazvratInitialMovement}
        onConfirmVazvrat={handleConfirmVazvrat}
      />

      {/* Excel / CSV Bulk Import Modal (1 kunda barcha tovarlarni kiritish) */}
      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        existingProducts={products}
        categories={categories}
        onConfirmImport={handleExecuteExcelImport}
        onImportSuccess={handleExecuteExcelImport}
      />

      {/* AI Foto Kirim Modal (Kamera + Gemini OCR) */}
      <PhotoKirimModal
        isOpen={isPhotoKirimModalOpen}
        onClose={() => setIsPhotoKirimModalOpen(false)}
        existingProducts={products}
        categories={categories}
        onConfirmKirim={handleConfirmKirim}
      />

      {/* Rasmiy Rangli PDF Hisobotlar Modali (Zakaz, Savdo, Ombor, Nasiyalar) */}
      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        initialReportType={pdfReportType}
        products={products}
        movements={movements}
        debts={debts}
        supplierDebts={supplierDebts}
        storeInfo={storeInfo}
        isAdminUnlocked={isAdminUnlocked}
      />

      {/* REST API & 1C / Telegram Bot Integratsiya Modali */}
      <ApiIntegrationModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiKey={apiKey}
        onSyncNow={handleSyncWithServer}
        isSyncing={isSyncingWithServer}
      />

      {/* Ishchi uchun telefon pastki menyusi: faqat Kassa, Nasiya, Qaytarish, Chiqish */}
      {isWorkerUser && (
        <div className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800 px-2 py-1 shadow-2xl safe-area-bottom">
          <div className="flex items-center justify-around">
            {([
              { label: 'Kassa', active: activeTab === 'chiqim', onClick: () => setActiveTab('chiqim') },
              { label: 'Mijozlar', active: activeTab === 'customers', onClick: () => setActiveTab('customers') },
              { label: 'Nasiya', active: activeTab === 'debts', onClick: () => setActiveTab('debts') },
              { label: 'Qaytarish', active: false, onClick: () => handleOpenVazvratModal() },
              { label: 'Chiqish', active: false, onClick: () => handleAdminLock() }
            ]).map(item => (
              <button key={item.label} type="button" onClick={() => { setIsMobileMenuOpen(false); item.onClick(); }}
                className={`flex-1 py-3 text-[11px] font-black ${item.active ? 'text-amber-400' : 'text-stone-300'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar (Telefonda Asosiy Qulay Boshqaruv) */}
      {!isWorkerUser && (
      <div className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800 px-2 py-1 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-around">
          {/* 1. Kassa (Sotuv) */}
          <button
            onClick={() => {
              setActiveTab('chiqim');
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'chiqim' && !isMobileMenuOpen
                ? 'text-amber-400 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'chiqim' && !isMobileMenuOpen ? 'bg-amber-400/20' : ''}`}>
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Kassa</span>
          </button>

          {/* 2. Kirim */}
          <button
            onClick={() => {
              setActiveTab('kirim');
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'kirim' && !isMobileMenuOpen
                ? 'text-emerald-400 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'kirim' && !isMobileMenuOpen ? 'bg-emerald-400/20' : ''}`}>
              <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Kirim</span>
          </button>

          {/* 3. AI Foto Kirim (Telefon kamerasini bir bosishda ochish) */}
          <button
            type="button"
            onClick={() => {
              setIsPhotoKirimModalOpen(true);
              setIsMobileMenuOpen(false);
            }}
            className="flex flex-col items-center justify-center -mt-4 py-1 px-2.5 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-stone-950 shadow-lg active:scale-95 transition-all cursor-pointer border-2 border-stone-900"
            title="AI Foto Kirim (Kamera orqali tovar qabul qilish)"
          >
            <div className="p-1.5 rounded-xl bg-stone-950 text-amber-400 shadow-inner">
              <Camera className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[9px] font-black mt-0.5 tracking-tight uppercase">Foto</span>
          </button>

          {/* 4. Ombor */}
          <button
            onClick={() => {
              setActiveTab('stock');
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'stock' && !isMobileMenuOpen
                ? 'text-amber-400 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'stock' && !isMobileMenuOpen ? 'bg-amber-400/20' : ''}`}>
              <Package className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Ombor</span>
          </button>

          {/* 4. Nasiya */}
          <button
            onClick={() => {
              setActiveTab('debts');
              setIsMobileMenuOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'debts' && !isMobileMenuOpen
                ? 'text-amber-400 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'debts' && !isMobileMenuOpen ? 'bg-amber-400/20' : ''}`}>
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Nasiya</span>
            {activeDebtsCount > 0 && (
              <span className="absolute top-1 right-2 px-1 py-0.2 bg-amber-400 text-stone-950 font-black text-[9px] rounded-full leading-none">
                {activeDebtsCount}
              </span>
            )}
          </button>

          {/* 5. Boshqaruv (Foyda, Ta'minotchi, Jurnal, Hisobchi) */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              isMobileMenuOpen || ['report', 'supplier-debts', 'journal', 'hisobchi'].includes(activeTab)
                ? 'text-amber-400 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${isMobileMenuOpen ? 'bg-amber-400/20' : ''}`}>
              <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Boshqaruv</span>
            {!isAdminUnlocked && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
        </div>
      </div>
      )}

      {/* Mobile Management Sheet (Boshqaruv va Rahbar Menyu): faqat Rahbar */}
      {isMobileMenuOpen && !isWorkerUser && (
        <div className="no-print lg:hidden fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex flex-col justify-end transition-opacity">
          <div 
            className="flex-1"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="bg-stone-900 text-white rounded-t-3xl border-t border-stone-800 p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>Boshqaruv & Rahbar Bo'limi</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Foyda, hisobotlar va qo'shimcha amallar
                </p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-full bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Status Pill */}
            <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${isAdminUnlocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'}`}>
                  {isAdminUnlocked ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-black text-white">
                    {isAdminUnlocked ? '🔓 Rahbar Rejimi Ochiq' : '🔒 Kassir Rejimi'}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {isAdminUnlocked ? 'Foyda va tan narxlar ko\'rinmoqda' : 'Foyda va qarzlar yashiringan'}
                  </div>
                </div>
              </div>

              {isAdminUnlocked ? (
                <button
                  onClick={() => {
                    handleAdminLock();
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Qulflash</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleRequireAdminPin();
                  }}
                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>PIN kiritish</span>
                </button>
              )}
            </div>

            {/* Management Menu Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Kunlik Foyda */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (!isAdminUnlocked) {
                    handleRequireAdminPin('report');
                  } else {
                    setActiveTab('report');
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  activeTab === 'report'
                    ? 'bg-amber-400 text-stone-950 border-amber-400'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  {!isAdminUnlocked && <Lock className="w-3.5 h-3.5 text-stone-500" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black">Kunlik Foyda</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Sof daromad & tushum</div>
                </div>
              </button>

              {/* Ta'minotchi Qarzlari */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (!isAdminUnlocked) {
                    handleRequireAdminPin('supplier-debts');
                  } else {
                    setActiveTab('supplier-debts');
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  activeTab === 'supplier-debts'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Truck className="w-5 h-5 text-red-400" />
                  {activeSupplierDebtsCount > 0 ? (
                    <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full">
                      {activeSupplierDebtsCount}
                    </span>
                  ) : !isAdminUnlocked ? (
                    <Lock className="w-3.5 h-3.5 text-stone-500" />
                  ) : null}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black">Ta'minotchi Qarzi</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Dilerlarga qarzlar</div>
                </div>
              </button>

              {/* Kirim-Chiqim Jurnali */}
              <button
                onClick={() => {
                  setActiveTab('journal');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  activeTab === 'journal'
                    ? 'bg-amber-400 text-stone-950 border-amber-400'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
                }`}
              >
                <FileText className="w-5 h-5 text-amber-400" />
                <div className="mt-2">
                  <div className="text-xs font-black">Harakatlar Jurnali</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Barcha savdo va cheklar</div>
                </div>
              </button>

              {/* Hisobchi Paneli */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (!isAdminUnlocked) {
                    handleRequireAdminPin('hisobchi');
                  } else {
                    setActiveTab('hisobchi');
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  activeTab === 'hisobchi'
                    ? 'bg-amber-400 text-stone-950 border-amber-400'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  {!isAdminUnlocked && <Lock className="w-3.5 h-3.5 text-stone-500" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black">Hisobchi Paneli</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Rekvizit & hisob-kitob</div>
                </div>
              </button>

              {/* AI Tahlilchi & Telegram Bot */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (!isAdminUnlocked) {
                    handleRequireAdminPin('ai-analyst');
                  } else {
                    setActiveTab('ai-analyst');
                  }
                }}
                className={`col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === 'ai-analyst'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black border-amber-300 shadow-md'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                      <span>AI Tahlilchi & Xarid Maslahatchisi</span>
                      {!isAdminUnlocked && <Lock className="w-3 h-3 text-amber-400/70" />}
                    </div>
                    <div className="text-[10px] text-amber-300/80 mt-0.5">Xatolar tahlili, zakaz tavsiyalari va Telegram bot</div>
                  </div>
                </div>
                <span className="text-xs font-black text-stone-950 bg-amber-400 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                  TG + AI
                </span>
              </button>

              {/* Telegram Mini App & Online Zakazlar Kassasi */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveTab('telegram-orders');
                }}
                className={`col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === 'telegram-orders'
                    ? 'bg-sky-500 text-white font-black border-sky-400 shadow-md'
                    : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 border-sky-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                    <Smartphone className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-sky-200 flex items-center gap-1.5">
                      <span>Telegram Mini App & Online Zakazlar</span>
                      {unprintedOrdersCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full animate-pulse">
                          {unprintedOrdersCount} yangi
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-sky-300/80 mt-0.5">Avtomatik kassa tushumi va termal printer cheki</div>
                  </div>
                </div>
                <span className="text-xs font-black text-sky-950 bg-sky-400 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                  Mini App
                </span>
              </button>

              {/* Rasmiy Rangli PDF Hisobotlar */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenPdfReports();
                }}
                className="col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer bg-amber-950/40 hover:bg-amber-900/40 text-amber-200 border-amber-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-200">Rasmiy Rangli PDF Hisobotlar</div>
                    <div className="text-[10px] text-amber-300/80 mt-0.5">Tugagan tovarlar zakazi, kunlik savdo va ombor hisoboti</div>
                  </div>
                </div>
                <span className="text-xs font-black text-stone-950 bg-amber-400 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                  PDF
                </span>
              </button>

              {/* Excel / CSV Ommaviy Kirim */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsExcelImportModalOpen(true);
                }}
                className="col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-200 border-emerald-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-emerald-200">Excel / CSV Ommaviy Tovar Yuklash</div>
                    <div className="text-[10px] text-emerald-300/80 mt-0.5">Jadval yuklash, narx va qoldiqlarni 1 kunda kiritish</div>
                  </div>
                </div>
                <span className="text-xs font-black text-white bg-emerald-600 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                  Excel
                </span>
              </button>

              {/* Tovar Qaytarish (Vazvrat) */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenVazvratModal();
                }}
                className="col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer bg-rose-950/40 hover:bg-rose-900/40 text-rose-200 border-rose-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-600/30 flex items-center justify-center text-rose-400 shrink-0">
                    <RotateCcw className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-rose-200">Mijozdan Tovar Qaytarish (Vazvrat)</div>
                    <div className="text-[10px] text-rose-300/80 mt-0.5">Sotilgan tovarni qabul qilish, omborga qaytarish & chek</div>
                  </div>
                </div>
                <span className="text-xs font-black text-white bg-rose-600 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                  Vazvrat
                </span>
              </button>
            </div>

            {/* Install button in mobile sheet */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsInstallModalOpen(true);
              }}
              className="w-full py-2.5 px-4 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-2xl text-xs font-bold text-stone-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Dasturni Telefonga O'rnatish Qo'llanmasi</span>
            </button>

            {/* REST API button in mobile sheet */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsApiModalOpen(true);
              }}
              className="w-full py-2.5 px-4 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 rounded-2xl text-xs font-bold text-cyan-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>REST API & 1C / Telegram Bot (v1.0)</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-stone-200 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-[10px]">
              B
            </div>
            <span className="font-semibold text-stone-800">
              {storeInfo.name} — Buxgalteriya & Hisobot Tizimi
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Рабочий столga chiqarish</span>
            </button>
            <span>•</span>
            <span>{storeInfo.address}</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
