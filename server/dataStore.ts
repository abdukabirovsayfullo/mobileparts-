import fs from 'fs';
import path from 'path';
import { 
  Product, 
  StockMovement, 
  DebtRecord, 
  SupplierDebtRecord, 
  StoreSettings,
  OnlineOrder,
  OnlineOrderItem,
  TelegramMiniAppOrderPayload,
  OnlineOrderStatus,
  SaleReceiptData
} from '../src/types';
import { 
  INITIAL_PRODUCTS, 
  DEFAULT_CATEGORIES, 
  STORE_INFO 
} from '../src/data/initialData';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  autoAlertLowStock: boolean;
  autoPrintOnlineOrders?: boolean;
  lastAlertSentAt?: string;
}

export interface PosDatabaseState {
  apiKey: string;
  storeInfo: StoreSettings;
  categories: string[];
  products: Product[];
  movements: StockMovement[];
  debts: DebtRecord[];
  supplierDebts: SupplierDebtRecord[];
  onlineOrders: OnlineOrder[];
  telegramConfig?: TelegramConfig;
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pos_database.json');

const DEFAULT_API_KEY = process.env.POS_API_KEY || 'pb_pos_sec_77a94d8b';
const DEMO_PRODUCT_KEYS = new Set(
  INITIAL_PRODUCTS.map(product => `${product.id}\u0000${product.barcode}\u0000${product.name}`)
);
const removeDemoProducts = (products: Product[]): Product[] => products.filter(product =>
  !DEMO_PRODUCT_KEYS.has(`${product.id}\u0000${product.barcode}\u0000${product.name}`)
);

class DataStore {
  private state: PosDatabaseState;
  private isSaving = false;

  constructor() {
    this.state = this.loadDatabase();
  }

  private loadDatabase(): PosDatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          apiKey: parsed.apiKey || DEFAULT_API_KEY,
          storeInfo: parsed.storeInfo || STORE_INFO,
          categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_CATEGORIES,
          products: Array.isArray(parsed.products) ? removeDemoProducts(parsed.products) : [],
          movements: Array.isArray(parsed.movements) ? parsed.movements : [],
          debts: Array.isArray(parsed.debts) ? parsed.debts : [],
          supplierDebts: Array.isArray(parsed.supplierDebts) ? parsed.supplierDebts : [],
          onlineOrders: Array.isArray(parsed.onlineOrders) ? parsed.onlineOrders : [],
          telegramConfig: parsed.telegramConfig || {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || '',
            enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
            autoAlertLowStock: true,
            autoPrintOnlineOrders: true
          },
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('[DataStore] Error reading database file, using fallback initial data:', err);
    }

    const initialState: PosDatabaseState = {
      apiKey: DEFAULT_API_KEY,
      storeInfo: STORE_INFO,
      categories: DEFAULT_CATEGORIES,
      products: [],
      movements: [],
      debts: [],
      supplierDebts: [],
      onlineOrders: [],
      telegramConfig: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        autoAlertLowStock: true,
        autoPrintOnlineOrders: true
      },
      lastUpdated: new Date().toISOString()
    };

    this.saveDatabaseSync(initialState);
    return initialState;
  }

  private saveDatabaseSync(state: PosDatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DataStore] Failed to write database file:', err);
    }
  }

  private scheduleSave() {
    if (this.isSaving) return;
    this.isSaving = true;
    setTimeout(() => {
      try {
        this.saveDatabaseSync(this.state);
      } finally {
        this.isSaving = false;
      }
    }, 200);
  }

  public getState(): PosDatabaseState {
    return this.state;
  }

  public getApiKey(): string {
    return this.state.apiKey || DEFAULT_API_KEY;
  }

  public setApiKey(key: string): string {
    this.state.apiKey = key.trim();
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state.apiKey;
  }

  public getCategories(): string[] {
    return this.state.categories || [];
  }

  public setCategories(categories: string[]): string[] {
    this.state.categories = categories;
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state.categories;
  }

  // --- Telegram Integration ---
  public getTelegramConfig(): TelegramConfig {
    if (!this.state.telegramConfig) {
      this.state.telegramConfig = {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        autoAlertLowStock: true
      };
    }
    return this.state.telegramConfig;
  }

  public setTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
    const current = this.getTelegramConfig();
    this.state.telegramConfig = {
      ...current,
      ...config,
      botToken: config.botToken !== undefined ? config.botToken.trim() : current.botToken,
      chatId: config.chatId !== undefined ? config.chatId.trim() : current.chatId,
      enabled: config.enabled !== undefined ? config.enabled : current.enabled,
      autoAlertLowStock: config.autoAlertLowStock !== undefined ? config.autoAlertLowStock : current.autoAlertLowStock,
      lastAlertSentAt: config.lastAlertSentAt || current.lastAlertSentAt
    };
    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state.telegramConfig;
  }

  // --- Products ---
  public getProducts(): Product[] {
    return this.state.products;
  }

  public getProductById(idOrBarcode: string): Product | undefined {
    const q = String(idOrBarcode || '').toLowerCase().trim();
    if (!q) return undefined;
    return this.state.products.find(p =>
      String(p.id || '').toLowerCase().trim() === q ||
      String(p.barcode || '').toLowerCase().trim() === q
    );
  }

  public saveProduct(productData: Partial<Product> & { name: string }): Product {
    const existingIndex = productData.id 
      ? this.state.products.findIndex(p => p.id === productData.id) 
      : productData.barcode 
        ? this.state.products.findIndex(p => p.barcode === productData.barcode)
        : -1;

    const purchasePrice = Number(productData.purchasePrice || productData.costPrice || 0);
    const sellingPrice = Number(productData.sellingPrice || Math.round((purchasePrice * 1.5) / 1000) * 1000);
    const wholesalePrice = Number(productData.wholesalePrice || Math.round((sellingPrice * 0.82) / 1000) * 1000);

    let savedProduct: Product;

    if (existingIndex >= 0) {
      const current = this.state.products[existingIndex];
      savedProduct = {
        ...current,
        ...productData,
        purchasePrice: purchasePrice || current.purchasePrice,
        costPrice: purchasePrice || current.costPrice,
        sellingPrice: sellingPrice || current.sellingPrice,
        wholesalePrice: wholesalePrice || current.wholesalePrice,
        stock: productData.stock !== undefined ? Number(productData.stock) : current.stock,
        minStockAlert: productData.minStockAlert !== undefined ? Number(productData.minStockAlert) : current.minStockAlert
      };
      this.state.products[existingIndex] = savedProduct;
    } else {
      const newId = productData.id || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newBarcode = productData.barcode || String(478000 + this.state.products.length + 1);
      savedProduct = {
        id: newId,
        name: productData.name,
        category: productData.category || 'Boshqa',
        brand: productData.brand || 'Universal',
        barcode: newBarcode,
        purchasePrice,
        costPrice: purchasePrice,
        wholesalePrice,
        sellingPrice,
        stock: Number(productData.stock || 0),
        minStockAlert: Number(productData.minStockAlert || 5)
      };
      this.state.products.push(savedProduct);
    }

    // Add category if not exists
    if (savedProduct.category && !this.state.categories.includes(savedProduct.category)) {
      this.state.categories.push(savedProduct.category);
    }

    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return savedProduct;
  }

  public deleteProduct(id: string): boolean {
    const idx = this.state.products.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.state.products.splice(idx, 1);
      this.state.lastUpdated = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Sales & Kirim ---
  public recordSale(salePayload: {
    items: Array<{ productId?: string; barcode?: string; quantity: number; unitPrice?: number }>;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    paymentMethod?: 'naqd' | 'click_payme' | 'uzum' | 'nasiya';
    discount?: number;
    notes?: string;
    dueDate?: string;
  }): {
    receiptNumber: string;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    movements: StockMovement[];
    debtRecord?: DebtRecord;
  } {
    const receiptNumber = `CHK-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const batchSaleId = `batch-${Date.now()}`;
    const timestamp = new Date().toISOString();

    let totalRevenue = 0;
    let totalCost = 0;
    const movements: StockMovement[] = [];

    const paymentMethod = salePayload.paymentMethod || 'naqd';
    const customerName = (salePayload.customerName || 'Chakana xaridor').trim();
    const customerPhone = (salePayload.customerPhone || '').trim();
    const discount = Math.max(0, Number(salePayload.discount || 0));

    for (const item of salePayload.items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      let product: Product | undefined;

      if (item.productId) product = this.getProductById(item.productId);
      if (!product && item.barcode) product = this.getProductById(item.barcode);

      if (!product) {
        throw new Error(`Tovar topilmadi (productId: ${item.productId || 'noma\'lum'}, barcode: ${item.barcode || 'noma\'lum'})`);
      }

      const unitPrice = Number(item.unitPrice || product.sellingPrice);
      const unitCost = Number(product.purchasePrice || product.costPrice || 0);

      const itemTotalRevenue = unitPrice * qty;
      const itemTotalCost = unitCost * qty;
      const itemProfit = itemTotalRevenue - itemTotalCost;

      totalRevenue += itemTotalRevenue;
      totalCost += itemTotalCost;

      // Decrement stock
      product.stock -= qty;

      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'chiqim',
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        unitCost,
        unitPrice,
        discountAmount: 0,
        totalCost: itemTotalCost,
        totalRevenue: itemTotalRevenue,
        profit: itemProfit,
        timestamp,
        paymentMethod,
        counterparty: customerName,
        customerPhone,
        customerAddress: salePayload.customerAddress || '',
        receiptNumber,
        batchSaleId,
        notes: salePayload.notes || ''
      };

      movements.push(mov);
      this.state.movements.unshift(mov);
    }

    // Apply overall discount if any to profit/revenue
    totalRevenue = Math.max(0, totalRevenue - discount);
    const totalProfit = totalRevenue - totalCost;

    let debtRecord: DebtRecord | undefined;
    if (paymentMethod === 'nasiya') {
      debtRecord = {
        id: `debt-${Date.now()}`,
        movementId: movements[0]?.id,
        customerName,
        customerPhone: customerPhone || '+998',
        totalDebt: totalRevenue,
        paidAmount: 0,
        remainingAmount: totalRevenue,
        dueDate: salePayload.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        createdAt: timestamp,
        status: 'faol',
        notes: `Chek raqami: ${receiptNumber}. ${salePayload.notes || ''}`.trim(),
        paymentHistory: []
      };
      this.state.debts.unshift(debtRecord);
    }

    this.state.lastUpdated = timestamp;
    this.scheduleSave();

    return {
      receiptNumber,
      totalRevenue,
      totalCost,
      totalProfit,
      movements,
      debtRecord
    };
  }

  public recordKirim(kirimPayload: {
    supplier?: string;
    supplierPhone?: string;
    isDebt?: boolean;
    dueDate?: string;
    items: Array<{
      productId?: string;
      barcode?: string;
      name?: string;
      category?: string;
      brand?: string;
      quantity: number;
      unitCost: number;
      sellingPrice?: number;
      wholesalePrice?: number;
    }>;
  }): {
    success: boolean;
    totalCost: number;
    movements: StockMovement[];
    supplierDebt?: SupplierDebtRecord;
  } {
    const timestamp = new Date().toISOString();
    const supplier = (kirimPayload.supplier || 'Ulgurji Ta\'minotchi').trim();
    let totalKirimCost = 0;
    const movements: StockMovement[] = [];
    const itemNames: string[] = [];

    for (const item of kirimPayload.items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitCost = Number(item.unitCost || 0);
      const sellingPrice = Number(item.sellingPrice || Math.round((unitCost * 1.5) / 1000) * 1000);
      const wholesalePrice = Number(item.wholesalePrice || Math.round((sellingPrice * 0.82) / 1000) * 1000);

      let product: Product | undefined;
      if (item.productId) {
        product = this.state.products.find(p => p.id === item.productId);
      }
      if (!product && item.barcode) {
        product = this.getProductById(item.barcode);
      }

      if (!product && item.name) {
        product = this.state.products.find(p => p.name.toLowerCase() === item.name?.toLowerCase());
      }

      if (product) {
        product.stock += qty;
        product.purchasePrice = unitCost;
        product.costPrice = unitCost;
        if (item.sellingPrice) product.sellingPrice = sellingPrice;
        if (item.wholesalePrice) product.wholesalePrice = wholesalePrice;
      } else {
        const newProduct: Product = {
          id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: item.name || `Aksessuar (${item.barcode || 'yangi'})`,
          category: item.category || 'Boshqa',
          brand: item.brand || 'Universal',
          barcode: item.barcode || String(478000 + this.state.products.length + 1),
          purchasePrice: unitCost,
          costPrice: unitCost,
          wholesalePrice,
          sellingPrice,
          stock: qty,
          minStockAlert: 5
        };
        product = newProduct;
        this.state.products.push(newProduct);
      }

      const itemCostTotal = unitCost * qty;
      totalKirimCost += itemCostTotal;
      itemNames.push(`${product.name} (${qty} dona)`);

      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'kirim',
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        unitCost,
        unitPrice: unitCost,
        totalCost: itemCostTotal,
        totalRevenue: itemCostTotal,
        profit: 0,
        timestamp,
        counterparty: supplier
      };

      movements.push(mov);
      this.state.movements.unshift(mov);
    }

    let supplierDebt: SupplierDebtRecord | undefined;
    if (kirimPayload.isDebt) {
      supplierDebt = {
        id: `sdebt-${Date.now()}`,
        supplierName: supplier,
        supplierPhone: kirimPayload.supplierPhone || '',
        productSummary: itemNames.slice(0, 5).join(', ') + (itemNames.length > 5 ? ` va yana ${itemNames.length - 5} ta tovar` : ''),
        totalDebt: totalKirimCost,
        paidAmount: 0,
        remainingAmount: totalKirimCost,
        dueDate: kirimPayload.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        createdAt: timestamp,
        status: 'faol',
        paymentHistory: []
      };
      this.state.supplierDebts.unshift(supplierDebt);
    }

    this.state.lastUpdated = timestamp;
    this.scheduleSave();

    return {
      success: true,
      totalCost: totalKirimCost,
      movements,
      supplierDebt
    };
  }

  // --- Movements & Debts ---
  public getMovements(limit = 50, type?: string): StockMovement[] {
    let list = this.state.movements;
    if (type) {
      list = list.filter(m => m.type === type);
    }
    return list.slice(0, Math.min(200, limit));
  }

  public getDebts(status?: string): DebtRecord[] {
    if (status) {
      return this.state.debts.filter(d => d.status === status);
    }
    return this.state.debts;
  }

  public recordDebtPayment(debtId: string, amount: number, method: 'naqd' | 'click_payme' = 'naqd'): DebtRecord {
    const debt = this.state.debts.find(d => d.id === debtId);
    if (!debt) {
      throw new Error(`Nasiya yozuvi topilmadi (ID: ${debtId})`);
    }

    const payAmount = Math.max(1, Number(amount));
    debt.paidAmount += payAmount;
    debt.remainingAmount = Math.max(0, debt.totalDebt - debt.paidAmount);
    debt.status = debt.remainingAmount <= 0 ? 'yopildi' : 'qisman_tolandi';

    if (!debt.paymentHistory) debt.paymentHistory = [];
    debt.paymentHistory.push({
      date: new Date().toISOString(),
      amount: payAmount,
      method
    });

    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return debt;
  }

  // --- Online Orders (Telegram Mini App / Online Store) ---
  public getOnlineOrders(limit = 100, status?: string): OnlineOrder[] {
    let list = this.state.onlineOrders || [];
    if (status) {
      list = list.filter(o => o.status === status);
    }
    return list.slice(0, limit);
  }

  public getUnprintedOnlineOrders(): OnlineOrder[] {
    const list = this.state.onlineOrders || [];
    return list.filter(o => !o.isPrinted && o.status !== 'bekor_qilindi');
  }

  public markOnlineOrderPrinted(id: string): OnlineOrder | undefined {
    const order = (this.state.onlineOrders || []).find(o => o.id === id);
    if (order) {
      order.isPrinted = true;
      order.printedAt = new Date().toISOString();
      if (order.status === 'yangi') {
        order.status = 'chiqarildi';
      }
      this.state.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return order;
  }

  public updateOnlineOrderStatus(id: string, status: OnlineOrderStatus): OnlineOrder | undefined {
    const order = (this.state.onlineOrders || []).find(o => o.id === id);
    if (order) {
      order.status = status;
      this.state.lastUpdated = new Date().toISOString();
      this.scheduleSave();
    }
    return order;
  }

  public recordOnlineOrder(payload: TelegramMiniAppOrderPayload): {
    order: OnlineOrder;
    receipt: SaleReceiptData;
    movements: StockMovement[];
  } {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("Buyurtma uchun kamida 1 ta tovar tanlanishi shart");
    }

    const timestamp = new Date().toISOString();
    const orderId = `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orderNumber = `TMA-${timestamp.slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const receiptNumber = `CHK-TMA-${timestamp.slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const batchSaleId = `batch-online-${Date.now()}`;

    const orderItems: OnlineOrderItem[] = [];
    const movements: StockMovement[] = [];
    let subtotal = 0;
    let totalCost = 0;

    for (const item of payload.items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      let product: Product | undefined;

      if (item.productId) product = this.getProductById(item.productId);
      if (!product && item.barcode) product = this.getProductById(item.barcode);

      // A cart can remain open while another device refreshes the catalog. In
      // that case the generated id may change, but the exact product name is
      // still enough to reconnect the order to a single server-side product.
      if (!product && item.productName) {
        const normalizedName = item.productName.toLowerCase().trim();
        const sameName = this.state.products.filter(p =>
          p.name.toLowerCase().trim() === normalizedName &&
          (!item.category || p.category.toLowerCase().trim() === item.category.toLowerCase().trim())
        );
        if (sameName.length === 1) product = sameName[0];
      }

      if (!product) {
        // Never invent stock during checkout. A stale cart must be refreshed
        // instead of silently creating a duplicate product with fake quantity.
        throw new Error("Savatdagi tovar eskirgan. Mini App'ni yangilang va tovarni qayta tanlang.");
      }

      const unitPrice = Number(item.unitPrice || product.sellingPrice);
      const unitCost = Number(product.purchasePrice || product.costPrice || 0);
      const lineTotal = unitPrice * qty;
      const lineCost = unitCost * qty;
      const profit = lineTotal - lineCost;

      subtotal += lineTotal;
      totalCost += lineCost;

      // Decrement stock immediately in POS
      product.stock = Math.max(0, product.stock - qty);

      orderItems.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        unitPrice,
        totalPrice: lineTotal,
        barcode: product.barcode
      });

      // Create cashier movement
      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'chiqim',
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        unitCost,
        unitPrice,
        totalCost: lineCost,
        totalRevenue: lineTotal,
        profit,
        timestamp,
        paymentMethod: payload.paymentMethod || 'naqd',
        counterparty: payload.customerName.trim() || 'Telegram Xaridor',
        customerPhone: payload.customerPhone.trim() || undefined,
        customerAddress: payload.customerAddress?.trim() || 'Telegram orqali buyurtma',
        receiptNumber,
        batchSaleId,
        notes: `[Telegram Mini App] Buyurtma #${orderNumber}. ${payload.notes ? `Izoh: ${payload.notes}` : ''}`.trim()
      };

      movements.push(mov);
      this.state.movements.unshift(mov);
    }

    const deliveryFee = payload.deliveryType === 'yetkazib_berish' ? 15000 : 0;
    const totalAmount = subtotal + deliveryFee;

    const newOrder: OnlineOrder = {
      id: orderId,
      orderNumber,
      receiptNumber,
      source: 'telegram_miniapp',
      status: 'yangi',
      createdAt: timestamp,
      customerName: (payload.customerName || 'Telegram Xaridor').trim(),
      customerPhone: (payload.customerPhone || '').trim(),
      customerAddress: (payload.customerAddress || '').trim(),
      telegramUserId: payload.telegramUserId,
      telegramUsername: payload.telegramUsername,
      paymentMethod: payload.paymentMethod || 'naqd',
      deliveryType: payload.deliveryType || 'olib_ketish',
      items: orderItems,
      subtotal,
      deliveryFee,
      totalAmount,
      notes: payload.notes || '',
      isPrinted: false
    };

    if (!this.state.onlineOrders) {
      this.state.onlineOrders = [];
    }
    this.state.onlineOrders.unshift(newOrder);

    // Prepare printable cashier receipt data
    const receipt: SaleReceiptData = {
      receiptNumber,
      date: timestamp,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone || undefined,
      customerAddress: newOrder.customerAddress || (newOrder.deliveryType === 'olib_ketish' ? "Do'kondan olib ketish" : "Yetkazib berish"),
      paymentMethod: newOrder.paymentMethod,
      items: orderItems.map(item => ({
        id: item.productId,
        name: item.productName,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice
      })),
      subtotal,
      total: totalAmount,
      notes: `Telegram Mini App #${orderNumber}. ${newOrder.notes ? `Izoh: ${newOrder.notes}` : ''}`.trim(),
      cashierName: "Online Kassa (Telegram)",
      showPrices: true
    };

    this.state.lastUpdated = timestamp;
    this.scheduleSave();

    return {
      order: newOrder,
      receipt,
      movements
    };
  }

  // --- Sync with frontend ---
  public syncFromClient(clientData: Partial<PosDatabaseState>): PosDatabaseState {
    if (Array.isArray(clientData.products) && clientData.products.length > 0) {
      this.state.products = clientData.products;
    }
    if (Array.isArray(clientData.movements) && clientData.movements.length > 0) {
      this.state.movements = clientData.movements;
    }
    if (Array.isArray(clientData.debts)) {
      this.state.debts = clientData.debts;
    }
    if (Array.isArray(clientData.supplierDebts)) {
      this.state.supplierDebts = clientData.supplierDebts;
    }
    if (Array.isArray(clientData.onlineOrders)) {
      this.state.onlineOrders = clientData.onlineOrders;
    }
    if (Array.isArray(clientData.categories) && clientData.categories.length > 0) {
      this.state.categories = clientData.categories;
    }
    if (clientData.storeInfo) {
      this.state.storeInfo = clientData.storeInfo;
    }
    if (clientData.telegramConfig) {
      this.state.telegramConfig = {
        ...this.getTelegramConfig(),
        ...clientData.telegramConfig
      };
    }

    this.state.lastUpdated = new Date().toISOString();
    this.scheduleSave();
    return this.state;
  }
}

export const dataStore = new DataStore();
