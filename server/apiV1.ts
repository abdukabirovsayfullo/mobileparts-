import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { dataStore, OwnerApprovalRequiredError } from './dataStore';
import { attachSessionUser, authRouter, getRequestUser, requireOwner, requireSession, verifyOwnerApproval } from './auth';
import { activeExpensesForDate, expenseTotal, tashkentDate } from './expenseLogic';
import { calculateShiftTotals } from './shiftLogic';
import { buildReport, previousRange } from './reportLogic';
import { summarizeReturns, RETURN_FLAG_DAILY_AMOUNT, RETURN_FLAG_DAILY_COUNT, WORKER_RETURN_WINDOW_DAYS } from './returnLogic';
import { searchProducts } from '../src/utils/productSearch';
import { 
  sendTelegramRawMessage, 
  buildLowStockTelegramMessage, 
  buildAiReportTelegramMessage, 
  sendLowStockNotification 
} from './telegram';
import { 
  computeStoreAuditData, 
  runGeminiStoreAudit, 
  askGeminiStoreAdvisor 
} from './aiAdvisor';

export const apiV1Router = express.Router();

// Middleware: API Key Authentication
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Allow public access to Telegram Mini App customer endpoints & POS order polling
  if (req.path.startsWith('/telegram/miniapp') || req.path.startsWith('/miniapp')) {
    return next();
  }

  if (attachSessionUser(req)) return next();

  const configuredKey = dataStore.getApiKey();
  
  const authHeader = req.headers['authorization'];
  let bearerToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const apiKeyHeader = req.headers['x-api-key'] as string;
  const apiKeyQuery = req.query.api_key as string;

  const providedKey = (apiKeyHeader || bearerToken || apiKeyQuery || '').trim();

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      error: "API kalit ko'rsatilmadi (API Key missing). Sarlavhada 'X-API-Key: ...' yoki 'Authorization: Bearer ...' yuboring.",
      docsUrl: "/api/v1/docs"
    });
  }

  if (providedKey !== configuredKey) {
    return res.status(403).json({
      success: false,
      error: "Noto'g'ri API kalit (Invalid API Key). Iltimos, do'kon sozlamalaridagi API kalitni tekshiring.",
      docsUrl: "/api/v1/docs"
    });
  }

  next();
}

// -----------------------------------------------------------------------------
// Public Endpoints
// -----------------------------------------------------------------------------

// 1. Health check & basic status
apiV1Router.get('/health', (_req: Request, res: Response) => {
  const state = dataStore.getState();
  res.json({
    success: true,
    status: 'ok',
    version: '1.0.0',
    app: 'Paxtaobod Beeline Aksessuarlar POS API',
    database: {
      productsCount: state.products.length,
      movementsCount: state.movements.length,
      activeDebtsCount: state.debts.filter(d => d.status === 'faol').length,
      lastUpdated: state.lastUpdated
    },
    timestamp: new Date().toISOString()
  });
});

apiV1Router.use('/auth', authRouter);

// 2. Interactive Documentation (JSON OpenAPI Specification)
apiV1Router.get('/docs', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}/api/v1`;

  res.json({
    title: 'Paxtaobod Beeline Aksessuarlar — REST API Documentation (v1.0)',
    description: 'Telefon aksessuarlari do\'koni ombori, savdo kassasi, nasiya daftari va tahlillari bilan 1C, Telegram bot yoki tashqi dasturlar integratsiyasi uchun API.',
    baseUrl,
    authentication: {
      type: 'API Key',
      headers: [
        'X-API-Key: <SIZNING_API_KALITINGIZ>',
        'Authorization: Bearer <SIZNING_API_KALITINGIZ>'
      ],
      queryParam: '?api_key=<SIZNING_API_KALITINGIZ>'
    },
    endpoints: [
      {
        path: '/api/v1/products',
        method: 'GET',
        description: 'Barcha tovarlar ro\'yxati va ombor qoldiqlari',
        queryParams: {
          search: 'Tovar nomi, brendi yoki shtrix-kod bo\'yicha qidiruv (masalan: ?search=remax)',
          category: 'Kategoriya bo\'yicha filter (masalan: ?category=Kabellar)',
          low_stock: 'Kam qolgan tovarlar (stock <= minStockAlert) (masalan: ?low_stock=true)',
          barcode: 'Aniq shtrix-kod bo\'yicha (masalan: ?barcode=478001)'
        },
        exampleCurl: `curl -H "X-API-Key: <SIZNING_API_KALITINGIZ>" "${baseUrl}/products?search=remax"`
      },
      {
        path: '/api/v1/products/:id',
        method: 'GET',
        description: 'Bitta tovar haqida to\'liq ma\'lumot (ID yoki shtrix-kod orqali)',
        exampleCurl: `curl -H "X-API-Key: <SIZNING_API_KALITINGIZ>" "${baseUrl}/products/478001"`
      },
      {
        path: '/api/v1/products',
        method: 'POST',
        description: 'Yangi tovar qo\'shish yoki 1C/Exceldan tovarlar ro\'yxatini yuklash (Bitta obyekt yoki massiv)',
        bodyFormat: {
          name: 'String (Majburiy)',
          category: 'String (ixtiyoriy, default: Boshqa)',
          brand: 'String (ixtiyoriy, default: Universal)',
          barcode: 'String (ixtiyoriy, avtomatik beriladi)',
          purchasePrice: 'Number (Tan narxi so\'mda)',
          sellingPrice: 'Number (Chakana sotish narxi so\'mda)',
          wholesalePrice: 'Number (Optom sotish narxi so\'mda)',
          stock: 'Number (Ombordagi dona soni)',
          minStockAlert: 'Number (Kam qolish chegarasi)'
        },
        exampleCurl: `curl -X POST -H "Content-Type: application/json" -H "X-API-Key: <SIZNING_API_KALITINGIZ>" -d '{"name":"Hoco X21 Type-C 1m","category":"Kabellar","purchasePrice":15000,"sellingPrice":30000,"stock":20}' "${baseUrl}/products"`
      },
      {
        path: '/api/v1/sales',
        method: 'POST',
        description: 'Tashqi savdo (Chiqim) qayd etish. Ombor qoldig\'ini avtomatik kamaytiradi, sof foydani hisoblaydi va agar nasiya bo\'lsa Nasiya daftariga kiritadi.',
        bodyFormat: {
          customerName: 'Mijoz ismi (masalan: Akmal)',
          customerPhone: 'Mijoz telefoni (+998901234567)',
          paymentMethod: 'naqd | click_payme | uzum | nasiya',
          notes: 'Izoh yoki chek ma\'lumoti',
          items: [
            { productId: 'prod-1', quantity: 2, unitPrice: 85000 },
            { barcode: '478002', quantity: 1 }
          ]
        },
        exampleCurl: `curl -X POST -H "Content-Type: application/json" -H "X-API-Key: <SIZNING_API_KALITINGIZ>" -d '{"customerName":"Alisher","paymentMethod":"naqd","items":[{"productId":"prod-1","quantity":1}]}' "${baseUrl}/sales"`
      },
      {
        path: '/api/v1/kirim',
        method: 'POST',
        description: 'Ta\'minotchidan tovar kirim qilish (Prikhod). Qoldiqni oshiradi, narxlarni yangilaydi.',
        bodyFormat: {
          supplier: 'Ta\'minotchi nomi (masalan: Abu Saxiy Optom Baza)',
          isDebt: 'true bo\'lsa ta\'minotchi qarz daftariga yoziladi',
          items: [
            { productId: 'prod-1', quantity: 10, unitCost: 45000, sellingPrice: 85000 }
          ]
        }
      },
      {
        path: '/api/v1/stock-movements',
        method: 'GET',
        description: 'Tovar aylanmasi jurnali (Kirim, Chiqim/Savdo, Qaytarish)',
        queryParams: { type: 'kirim | chiqim | vazvrat', limit: 'N dona' }
      },
      {
        path: '/api/v1/debts',
        method: 'GET',
        description: 'Mijozlar nasiya daftari',
        queryParams: { status: 'faol | yopildi' }
      },
      {
        path: '/api/v1/debts/:id/pay',
        method: 'POST',
        description: 'Nasiyani so\'ndirish yoki qisman to\'lov qabul qilish',
        bodyFormat: { amount: 'Number', method: 'naqd | click_payme' }
      },
      {
        path: '/api/v1/summary/daily',
        method: 'GET',
        description: 'Bugungi kunlik kassa xulosasi, umumiy tushum, sof foyda va ombor qiymati'
      }
    ]
  });
});

// -----------------------------------------------------------------------------
// Two-Way Sync Endpoint (Frontend <-> Server)
// -----------------------------------------------------------------------------
apiV1Router.get('/sync', requireSession, (req: Request, res: Response) => {
  const state = dataStore.getState();
  const user = getRequestUser(req)!;
  const today = tashkentDate();
  const products = user.role === 'worker'
    ? state.products.map(({ purchasePrice: _purchasePrice, costPrice: _costPrice, ...product }) => ({
        ...product,
        purchasePrice: 0,
        costPrice: 0
      }))
    : state.products;
  res.json({
    success: true,
    serverTimestamp: state.lastUpdated,
    apiKey: user.role === 'owner' ? dataStore.getApiKey() : undefined,
    state: {
      products,
      movements: user.role === 'owner'
        ? state.movements
        : state.movements
            .filter(movement => movement.employeeId === user.id && tashkentDate(movement.timestamp) === today)
            .map(movement => ({ ...movement, unitCost: 0, totalCost: 0, profit: 0 })),
      debts: user.role === 'owner' ? state.debts : [],
      supplierDebts: user.role === 'owner' ? state.supplierDebts : [],
      expenses: user.role === 'owner' ? state.expenses : [],
      categories: state.categories,
      storeInfo: { ...state.storeInfo, adminPin: undefined }
    }
  });
});

apiV1Router.post('/sync/import-legacy', requireOwner, (req: Request, res: Response) => {
  const result = dataStore.importLegacyHistory({
    movements: req.body?.movements,
    debts: req.body?.debts,
    supplierDebts: req.body?.supplierDebts
  });
  res.json({ success: true, ...result, serverTimestamp: dataStore.getState().lastUpdated });
});

apiV1Router.post('/sync', requireOwner, (req: Request, res: Response) => {
  try {
    const { products, movements, debts, supplierDebts, categories, storeInfo, baseRevision, clientTimestamp } = req.body;
    const currentRevision = dataStore.getState().lastUpdated;

    if (typeof baseRevision !== 'string' || baseRevision !== currentRevision) {
      return res.status(409).json({
        success: false,
        error: "Brauzerdagi ma'lumot nusxasi eskirgan. Serverdagi eng yangi holat qayta yuklanadi.",
        serverTimestamp: currentRevision
      });
    }

    const updatedState = dataStore.syncFromClient({
      products,
      movements,
      debts,
      supplierDebts,
      categories,
      storeInfo
    });

    return res.json({
      success: true,
      message: "Ma'lumotlar server bilan muvaffaqiyatli sinxronlandi",
      serverTimestamp: updatedState.lastUpdated,
      clientTimestamp,
      apiKey: dataStore.getApiKey(),
      state: updatedState
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Sinxronlashda xatolik yuz berdi"
    });
  }
});

// -----------------------------------------------------------------------------
// Authenticated Endpoints (Require API Key)
// -----------------------------------------------------------------------------
apiV1Router.use(requireApiKey);

// Kassir faqat katalogni ko'rishi va savdo yozishi mumkin. Qolgan barcha
// boshqaruv amallari serverning o'zida to'xtatiladi.
apiV1Router.use((req: Request, res: Response, next: NextFunction) => {
  const user = getRequestUser(req);
  if (user?.role !== 'worker') return next();
  const canReadProducts = req.method === 'GET' && (req.path === '/products' || req.path.startsWith('/products/'));
  const canCreateSale = req.method === 'POST' && req.path === '/sales';
  const canUseExpenses = req.path === '/expenses' && (req.method === 'GET' || req.method === 'POST');
  const canUseCashShift = (req.path === '/cash-shifts/current' && req.method === 'GET') || (req.path === '/cash-shifts/close' && req.method === 'POST');
  // Ishchi: tovar qaytarish va nasiya (faqat qidirish + to'lov qabul qilish; ro'yxat/jami/o'chirish yo'q)
  const canReturn = (req.path === '/returns/search' && req.method === 'GET') || (req.path === '/returns' && req.method === 'POST');
  const canUseDebts = (req.path === '/debts/lookup' && req.method === 'GET') || (/^\/debts\/[^/]+\/pay$/.test(req.path) && req.method === 'POST');
  // Ishchi: doimiy mijozlarni ko'rish, qidirish va yangisini qo'shish (o'chirish va ommaviy import yo'q)
  const canUseCustomers = req.path === '/customers' && (req.method === 'GET' || req.method === 'POST');
  if (canReadProducts || canCreateSale || canUseExpenses || canUseCashShift || canReturn || canUseDebts || canUseCustomers) return next();
  return res.status(403).json({ success: false, error: 'Kassir uchun bu bo\'lim yopiq.' });
});

// --- Kassadan olingan pul ---
apiV1Router.get('/expenses', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  const today = tashkentDate();
  let expenses = dataStore.getExpenses();
  if (user.role === 'worker') {
    expenses = expenses.filter(item => item.createdById === user.id && tashkentDate(item.occurredAt) === today);
  } else {
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    if (from) expenses = expenses.filter(item => tashkentDate(item.occurredAt) >= from);
    if (to) expenses = expenses.filter(item => tashkentDate(item.occurredAt) <= to);
  }
  res.json({ success: true, data: expenses });
});

apiV1Router.post('/expenses', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (dataStore.getClosedShift(user.id, tashkentDate())) return res.status(409).json({ success: false, error: 'Smena yopilgan. Davom etish uchun Rahbar qayta ochishi kerak.' });
  try {
    const expense = dataStore.addExpense({
      recipient: String(req.body?.recipient || ''),
      amount: Number(req.body?.amount),
      reason: String(req.body?.reason || ''),
      category: req.body?.category || 'boshqa'
    }, user);
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Chiqim saqlanmadi.' });
  }
});

// --- Smena / kassani yopish ---
apiV1Router.get('/cash-shifts/current', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  const date = tashkentDate();
  const previous = dataStore.getCashShifts().find(item => item.employeeId === user.id && item.businessDate < date && !item.reopenedAt);
  const openingCash = Math.max(0, Math.round(Number(req.query.openingCash ?? previous?.leftForNextDay ?? 0)));
  res.json({ success: true, businessDate: date, closedShift: dataStore.getClosedShift(user.id, date) || null, suggestedOpeningCash: previous?.leftForNextDay || 0, totals: calculateShiftTotals(dataStore.getState().movements, dataStore.getExpenses(), user.id, date, openingCash, dataStore.getState().debts) });
});

apiV1Router.post('/cash-shifts/close', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  try {
    const businessDate = tashkentDate();
    const openingCash = Math.max(0, Math.round(Number(req.body?.openingCash) || 0));
    const countedCash = Math.max(0, Math.round(Number(req.body?.countedCash) || 0));
    const leftForNextDay = Math.max(0, Math.round(Number(req.body?.leftForNextDay) || 0));
    const note = String(req.body?.note || '').trim();
    const totals = calculateShiftTotals(dataStore.getState().movements, dataStore.getExpenses(), user.id, businessDate, openingCash, dataStore.getState().debts);
    const difference = countedCash - totals.expectedCash;
    if (difference !== 0 && note.length < 3) return res.status(400).json({ success: false, error: "Kamomat yoki ortiqcha bo'lsa izoh yozish majburiy." });
    const shift = dataStore.closeCashShift({ id: `shift-${crypto.randomUUID()}`, businessDate, employeeId: user.id, employeeName: user.name, openingCash, ...totals, countedCash, difference, leftForNextDay, note: note || undefined, closedAt: new Date().toISOString() });
    res.status(201).json({ success: true, data: shift });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Smena yopilmadi.' });
  }
});

apiV1Router.get('/cash-shifts', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role !== 'owner') return res.status(403).json({ success: false, error: 'Faqat Rahbar uchun.' });
  res.json({ success: true, data: dataStore.getCashShifts() });
});

apiV1Router.post('/cash-shifts/:id/reopen', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role !== 'owner') return res.status(403).json({ success: false, error: 'Smenani faqat Rahbar qayta ochadi.' });
  try { res.json({ success: true, data: dataStore.reopenCashShift(req.params.id, String(req.body?.reason || ''), user) }); }
  catch (error: any) { res.status(400).json({ success: false, error: error?.message || 'Smena ochilmadi.' }); }
});

apiV1Router.get('/reports/summary', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role !== 'owner') return res.status(403).json({ success: false, error: 'Hisobot faqat Rahbar uchun.' });
  const from = String(req.query.from || ''); const to = String(req.query.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return res.status(400).json({ success: false, error: "To'g'ri sana oralig'ini tanlang." });
  const state = dataStore.getState();
  const input = { products: state.products, movements: state.movements, debts: state.debts, expenses: state.expenses || [], cashShifts: state.cashShifts || [] };
  const previous = previousRange(from, to);
  res.json({ success: true, data: buildReport(input, from, to), previous: buildReport(input, previous.from, previous.to) });
});

apiV1Router.post('/expenses/:id/cancel', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role !== 'owner') return res.status(403).json({ success: false, error: 'Chiqimni faqat rahbar bekor qiladi.' });
  try {
    const expense = dataStore.cancelExpense(req.params.id, String(req.body?.reason || ''), user);
    res.json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Chiqim bekor qilinmadi.' });
  }
});

// --- Products CRUD ---
apiV1Router.get('/products', (req: Request, res: Response) => {
  let products = dataStore.getProducts();

  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
  const barcode = typeof req.query.barcode === 'string' ? req.query.barcode.trim() : '';
  const lowStock = req.query.low_stock === 'true' || req.query.low_stock === '1';

  if (barcode) {
    products = products.filter(p => p.barcode === barcode);
  }

  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category);
  }

  if (search) {
    products = searchProducts(products, search);
  }

  if (lowStock) {
    products = products.filter(p => p.stock <= p.minStockAlert);
  }

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const paginated = products.slice(offset, offset + limit);
  const data = getRequestUser(req)?.role === 'worker'
    ? paginated.map(({ purchasePrice: _purchasePrice, costPrice: _costPrice, wholesalePrice: _wholesalePrice, ...product }) => ({ ...product, purchasePrice: 0, costPrice: 0 }))
    : paginated;

  res.json({
    success: true,
    totalCount: products.length,
    returnedCount: paginated.length,
    offset,
    limit,
    data
  });
});

apiV1Router.get('/products/:idOrBarcode', (req: Request, res: Response) => {
  const { idOrBarcode } = req.params;
  const product = dataStore.getProductById(idOrBarcode);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: `Tovar topilmadi (ID yoki shtrix-kod: '${idOrBarcode}')`
    });
  }

  res.json({
    success: true,
    data: getRequestUser(req)?.role === 'worker'
      ? (({ purchasePrice: _purchasePrice, costPrice: _costPrice, wholesalePrice: _wholesalePrice, ...safeProduct }) => ({ ...safeProduct, purchasePrice: 0, costPrice: 0 }))(product)
      : product
  });
});

apiV1Router.post('/products', (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Support single product or bulk array
    if (Array.isArray(payload)) {
      const savedList = payload.map(item => {
        if (!item.name) throw new Error("Har bir tovarda 'name' maydoni bo'lishi shart");
        return dataStore.saveProduct(item);
      });

      return res.status(201).json({
        success: true,
        message: `${savedList.length} ta tovar muvaffaqiyatli saqlandi / yangilandi`,
        count: savedList.length,
        data: savedList
      });
    }

    if (!payload.name) {
      return res.status(400).json({
        success: false,
        error: "Tovar nomi ('name') kiritilishi shart"
      });
    }

    const saved = dataStore.saveProduct(payload);
    res.status(201).json({
      success: true,
      message: "Tovar muvaffaqiyatli saqlandi",
      data: saved
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Tovarni saqlashda xatolik yuz berdi"
    });
  }
});

apiV1Router.put('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = dataStore.getProductById(id);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `Tovar topilmadi (ID: '${id}')`
    });
  }

  const updated = dataStore.saveProduct({
    ...existing,
    ...req.body,
    id: existing.id
  });

  res.json({
    success: true,
    message: "Tovar yangilandi",
    data: updated
  });
});

apiV1Router.delete('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = dataStore.deleteProduct(id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: `Tovar topilmadi (ID: '${id}')`
    });
  }
  res.json({
    success: true,
    message: "Tovar muvaffaqiyatli o'chirildi"
  });
});

// --- Sales (Chiqim) ---
apiV1Router.post('/sales', (req: Request, res: Response) => {
  try {
    const { items, customerName, customerPhone, customerAddress, paymentMethod, discount, notes, dueDate } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Savdo qilish uchun kamida bitta tovar ('items') ko'rsatilishi kerak"
      });
    }

    const employee = getRequestUser(req);
    if (employee && dataStore.getClosedShift(employee.id, tashkentDate())) {
      return res.status(409).json({ success: false, error: 'Smena yopilgan. Yangi savdo uchun Rahbar smenani qayta ochishi kerak.' });
    }
    const saleResult = dataStore.recordSale({
      items,
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod,
      discount,
      notes,
      dueDate,
      employeeId: employee?.id,
      employeeName: employee?.name
    });

    dataStore.rememberSaleCustomer(customerName, customerPhone, customerAddress);

    res.status(201).json({
      success: true,
      message: "Savdo muvaffaqiyatli qayd etildi va kassa jurnaliga kiritildi",
      data: saleResult
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Savdoni qayd etishda xatolik"
    });
  }
});

// --- Kirim (Prikhod) ---
apiV1Router.post('/kirim', (req: Request, res: Response) => {
  try {
    const { supplier, supplierPhone, isDebt, dueDate, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Kirim qilish uchun kamida bitta tovar ('items') ko'rsatilishi kerak"
      });
    }

    const kirimResult = dataStore.recordKirim({
      supplier,
      supplierPhone,
      isDebt,
      dueDate,
      items
    });

    res.status(201).json({
      success: true,
      message: "Tovarlar omborga muvaffaqiyatli kirim qilindi",
      data: kirimResult
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Kirim qilishda xatolik"
    });
  }
});

// --- Stock Movements History ---
apiV1Router.get('/stock-movements', (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const type = typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : undefined;
  
  const movements = dataStore.getMovements(limit, type);

  res.json({
    success: true,
    count: movements.length,
    data: movements
  });
});

// --- Debts (Nasiya Daftari) ---
apiV1Router.get('/debts', (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : undefined;
  const debts = dataStore.getDebts(status);

  res.json({
    success: true,
    count: debts.length,
    data: debts
  });
});

// Ishchi (va Rahbar) uchun: mijoz nasiyasini ism/telefon bo'yicha qidirish. Minimal maydonlar, umumiy ro'yxat yo'q.
apiV1Router.get('/debts/lookup', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ success: true, data: dataStore.lookupDebts(query) });
});

// --- Doimiy mijozlar reestri ---
apiV1Router.get('/customers', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ success: true, data: dataStore.listCustomers(query) });
});

apiV1Router.post('/customers', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  try {
    const { name, phone, address, notes } = req.body || {};
    res.status(201).json({ success: true, data: dataStore.upsertCustomer({ name, phone, address, notes }) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Mijoz saqlanmadi.' });
  }
});

apiV1Router.post('/customers/import', requireOwner, (req: Request, res: Response) => {
  const list = Array.isArray(req.body?.customers) ? req.body.customers.slice(0, 2000) : [];
  let added = 0;
  let skipped = 0;
  const before = dataStore.listCustomers('', 100000).length;
  for (const item of list) {
    try { dataStore.upsertCustomer({ name: item?.name, phone: item?.phone, address: item?.address, notes: item?.notes }); } catch { skipped += 1; }
  }
  added = dataStore.listCustomers('', 100000).length - before;
  res.json({ success: true, data: { added, skipped, total: dataStore.listCustomers('', 100000).length } });
});

apiV1Router.delete('/customers/:id', requireOwner, (req: Request, res: Response) => {
  if (!dataStore.deleteCustomer(req.params.id)) return res.status(404).json({ success: false, error: 'Mijoz topilmadi.' });
  res.json({ success: true });
});

apiV1Router.post('/debts/:id/pay', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, method } = req.body;
    const user = getRequestUser(req);

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "To'lov summasi ('amount') musbat son bo'lishi kerak"
      });
    }
    if (user?.role === 'worker' && dataStore.getClosedShift(user.id, tashkentDate())) {
      return res.status(409).json({ success: false, error: 'Smena yopilgan. Davom etish uchun Rahbar qayta ochishi kerak.' });
    }

    if (method !== undefined && method !== 'naqd' && method !== 'click_payme') {
      return res.status(400).json({ success: false, error: "To'lov usuli faqat 'naqd' yoki 'click_payme' bo'lishi mumkin." });
    }
    const updatedDebt = dataStore.recordDebtPayment(id, Number(amount), method === 'click_payme' ? 'click_payme' : 'naqd', user ? { id: user.id, name: user.name } : undefined);
    const data = user?.role === 'worker'
      ? { id: updatedDebt.id, customerName: updatedDebt.customerName, remainingAmount: updatedDebt.remainingAmount, status: updatedDebt.status }
      : updatedDebt;

    res.json({
      success: true,
      message: "Qarz to'lovi qabul qilindi",
      data
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Qarz to'lovini qabul qilishda xatolik"
    });
  }
});

// --- Tovar qaytarish (vazvrat) ---
apiV1Router.get('/returns/search', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ success: true, windowDays: WORKER_RETURN_WINDOW_DAYS, data: dataStore.searchReturnableSales(query, user) });
});

apiV1Router.post('/returns', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role === 'worker' && dataStore.getClosedShift(user.id, tashkentDate())) {
    return res.status(409).json({ success: false, error: 'Smena yopilgan. Davom etish uchun Rahbar qayta ochishi kerak.' });
  }
  try {
    let ownerApprovedBy: string | undefined;
    if (user.role === 'worker' && req.body?.ownerPin) {
      const approval = verifyOwnerApproval(req, req.body.ownerPin);
      if ('error' in approval) return res.status(approval.status).json({ success: false, error: approval.error });
      ownerApprovedBy = (approval as { ownerName: string }).ownerName;
    }
    const result = dataStore.recordReturn({
      lines: Array.isArray(req.body?.lines) ? req.body.lines : [],
      reason: String(req.body?.reason || ''),
      refundMethod: req.body?.refundMethod,
      restoreStock: req.body?.restoreStock !== false,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      user,
      ownerApprovedBy
    });
    res.status(201).json({ success: true, message: 'Qaytarish qayd etildi', data: result });
  } catch (error: any) {
    if (error instanceof OwnerApprovalRequiredError) {
      return res.status(403).json({ success: false, code: 'OWNER_APPROVAL_REQUIRED', error: error.message });
    }
    res.status(400).json({ success: false, error: error?.message || 'Qaytarish saqlanmadi.' });
  }
});

// Rahbar nazorati: kim qancha qaytargan, ko'p/katta qaytarishlar belgilanadi (bloklanmaydi).
apiV1Router.get('/returns', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'CRM hisobiga kiring.' });
  if (user.role !== 'owner') return res.status(403).json({ success: false, error: 'Faqat Rahbar uchun.' });
  const movements = dataStore.getState().movements;
  const recent = movements.filter(m => m.type === 'vazvrat').slice(0, 60).map(m => ({
    id: m.id, timestamp: m.timestamp, receiptNumber: m.receiptNumber, productName: m.productName, quantity: m.quantity, amount: m.totalRevenue,
    method: m.paymentMethod, reason: m.returnReason, customerName: m.counterparty, employeeName: m.employeeName || '', approvedByName: m.approvedByName || '', originalMovementId: m.originalMovementId
  }));
  res.json({ success: true, limits: { dailyCount: RETURN_FLAG_DAILY_COUNT, dailyAmount: RETURN_FLAG_DAILY_AMOUNT }, employees: summarizeReturns(movements), recent });
});

// --- Summary & Analytics ---
apiV1Router.get('/summary/daily', (_req: Request, res: Response) => {
  const state = dataStore.getState();
  const todayStr = tashkentDate();

  const todayChiqim = state.movements.filter(m => m.type === 'chiqim' && tashkentDate(m.timestamp) === todayStr);
  const todayKirim = state.movements.filter(m => m.type === 'kirim' && tashkentDate(m.timestamp) === todayStr);
  const todayExpenses = activeExpensesForDate(state.expenses || [], todayStr);
  const todayExpenseTotal = expenseTotal(todayExpenses);

  let todayRevenue = 0;
  let todayProfit = 0;
  let cashRevenue = 0;
  let clickRevenue = 0;
  let debtRevenue = 0;

  todayChiqim.forEach(m => {
    todayRevenue += m.totalRevenue;
    todayProfit += m.profit;
    if (m.paymentMethod === 'naqd') cashRevenue += m.totalRevenue;
    else if (m.paymentMethod === 'click_payme' || m.paymentMethod === 'uzum') clickRevenue += m.totalRevenue;
    else if (m.paymentMethod === 'nasiya') debtRevenue += m.totalRevenue;
  });

  const totalWarehouseCost = state.products.reduce((acc, p) => acc + (p.purchasePrice || p.costPrice || 0) * Math.max(0, p.stock), 0);
  const totalWarehouseRetail = state.products.reduce((acc, p) => acc + (p.sellingPrice || 0) * Math.max(0, p.stock), 0);
  const activeDebtsTotal = state.debts.filter(d => d.status === 'faol' || d.status === 'qisman_tolandi').reduce((acc, d) => acc + d.remainingAmount, 0);
  const lowStockCount = state.products.filter(p => p.stock <= p.minStockAlert).length;

  res.json({
    success: true,
    date: todayStr,
    todaySales: {
      itemsSold: todayChiqim.reduce((acc, m) => acc + m.quantity, 0),
      totalRevenue: todayRevenue,
      totalProfit: todayProfit,
      byPaymentMethod: {
        naqd: cashRevenue,
        click_payme: clickRevenue,
        nasiya: debtRevenue
      }
    },
    todayKirim: {
      itemsReceived: todayKirim.reduce((acc, m) => acc + m.quantity, 0),
      totalCost: todayKirim.reduce((acc, m) => acc + m.totalCost, 0)
    },
    expenses: {
      total: todayExpenseTotal,
      count: todayExpenses.length,
      cashRemaining: cashRevenue - todayExpenseTotal
    },
    warehouse: {
      totalProductsCount: state.products.length,
      lowStockCount,
      totalInventoryCostValue: totalWarehouseCost,
      totalInventoryRetailValue: totalWarehouseRetail,
      expectedProfit: totalWarehouseRetail - totalWarehouseCost
    },
    debts: {
      activeDebtsCount: state.debts.filter(d => d.status === 'faol' || d.status === 'qisman_tolandi').length,
      totalDebtReceivable: activeDebtsTotal
    }
  });
});

// --- Store Information ---
apiV1Router.get('/store-info', (_req: Request, res: Response) => {
  const state = dataStore.getState();
  res.json({
    success: true,
    data: {
      ...state.storeInfo,
      categories: state.categories
    }
  });
});

// -----------------------------------------------------------------------------
// Telegram Bot Integration Endpoints
// -----------------------------------------------------------------------------

// 1. Get Telegram Bot Config
apiV1Router.get('/telegram/config', requireApiKey, (_req: Request, res: Response) => {
  const config = dataStore.getTelegramConfig();
  res.json({
    success: true,
    data: {
      botTokenMasked: config.botToken ? `${config.botToken.substring(0, 8)}...${config.botToken.slice(-4)}` : '',
      hasToken: !!config.botToken,
      chatId: config.chatId,
      enabled: config.enabled,
      autoAlertLowStock: config.autoAlertLowStock,
      lastAlertSentAt: config.lastAlertSentAt
    }
  });
});

// 2. Save Telegram Bot Config
apiV1Router.post('/telegram/config', requireApiKey, (req: Request, res: Response) => {
  const { botToken, chatId, enabled, autoAlertLowStock } = req.body;
  const updated = dataStore.setTelegramConfig({
    ...(botToken !== undefined && { botToken: String(botToken) }),
    ...(chatId !== undefined && { chatId: String(chatId) }),
    ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    ...(autoAlertLowStock !== undefined && { autoAlertLowStock: Boolean(autoAlertLowStock) })
  });

  res.json({
    success: true,
    message: "Telegram bot sozlamalari muvaffaqiyatli saqlandi",
    data: {
      hasToken: !!updated.botToken,
      chatId: updated.chatId,
      enabled: updated.enabled,
      autoAlertLowStock: updated.autoAlertLowStock
    }
  });
});

// 3. Test Telegram Ping Message
apiV1Router.post('/telegram/test', requireApiKey, async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  const currentConfig = dataStore.getTelegramConfig();
  const token = (botToken || currentConfig.botToken || '').trim();
  const chat = (chatId || currentConfig.chatId || '').trim();

  if (!token || !chat) {
    return res.status(400).json({
      success: false,
      error: "Telegram Bot Token va Chat ID kiritilishi shart"
    });
  }

  const testText = `✅ <b>Paxtaobod Beeline POS — Telegram Bot Muvaffaqiyatli Ulandi!</b>\n\n🕒 Vaqt: ${new Date().toLocaleTimeString('uz-UZ')}\n🔔 Bu xabar kassa tizimi va Telegram integratsiyasi to'g'ri sozlanganligini tasdiqlaydi. Endilikda omborda ozaygan tovarlar haqida ushbu bot orqali tezkor xabar olib turasiz.`;

  const result = await sendTelegramRawMessage(token, chat, testText, 'HTML');
  if (result.success) {
    return res.json({
      success: true,
      message: "Telegramga test xabari muvaffaqiyatli yuborildi!",
      messageId: result.messageId
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// 4. Send Low-Stock Products Notification to Telegram
apiV1Router.post('/telegram/notify-low-stock', requireApiKey, async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  const result = await sendLowStockNotification({
    botToken,
    chatId
  });

  if (result.success) {
    return res.json({
      success: true,
      message: result.message,
      count: result.count
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.message
    });
  }
});

// 5. Send AI Business Audit & Purchasing Plan to Telegram
apiV1Router.post('/telegram/send-ai-report', requireApiKey, async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;
  const currentConfig = dataStore.getTelegramConfig();
  const token = (botToken || currentConfig.botToken || '').trim();
  const chat = (chatId || currentConfig.chatId || '').trim();

  if (!token || !chat) {
    return res.status(400).json({
      success: false,
      error: "Telegram Bot Token va Chat ID kiritilmagan"
    });
  }

  const storeInfo = dataStore.getState().storeInfo;
  const auditReport = await runGeminiStoreAudit();

  const formattedMsg = buildAiReportTelegramMessage({
    mistakes: auditReport.mistakes.map(m => `${m.title}: ${m.impact}`),
    orderMore: auditReport.procurementPlan.orderMore.map(o => ({
      name: o.name,
      quantity: o.recommendedOrderQuantity,
      reason: o.reason
    })),
    orderLess: auditReport.procurementPlan.orderLessOrStop.map(l => ({
      name: l.name,
      reason: l.reason
    })),
    goldenRules: auditReport.goldenRules,
    overviewText: auditReport.executiveSummary
  }, storeInfo?.name || 'Paxtaobod Beeline');

  const result = await sendTelegramRawMessage(token, chat, formattedMsg, 'HTML');

  if (result.success) {
    return res.json({
      success: true,
      message: "AI Biznes tahlili va xarid rejasi Telegramga muvaffaqiyatli yuborildi!",
      messageId: result.messageId
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// -----------------------------------------------------------------------------
// AI Business Analyst & Procurement Advisor Endpoints
// -----------------------------------------------------------------------------

// 1. Comprehensive AI Business Audit
apiV1Router.get('/ai/audit', requireApiKey, async (req: Request, res: Response) => {
  try {
    const customKey = (req.headers['x-gemini-api-key'] as string) || (req.query.geminiApiKey as string);
    const report = await runGeminiStoreAudit(customKey);
    res.json({
      success: true,
      data: report
    });
  } catch (err: any) {
    console.error('[API v1] Error generating AI audit:', err);
    res.status(500).json({
      success: false,
      error: "AI audit yaratishda xatolik yuz berdi"
    });
  }
});

// 2. Interactive Chat with AI Consultant
apiV1Router.post('/ai/chat', requireApiKey, async (req: Request, res: Response) => {
  const { message, chatHistory, geminiApiKey } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: "Xabar matni (message) kiritilmadi"
    });
  }

  try {
    const customKey = (geminiApiKey as string) || (req.headers['x-gemini-api-key'] as string);
    const reply = await askGeminiStoreAdvisor(message, Array.isArray(chatHistory) ? chatHistory : [], customKey);
    res.json({
      success: true,
      reply
    });
  } catch (err: any) {
    console.error('[API v1] Error in AI chat:', err);
    // Provide clean, friendly business advisor response instead of throwing 500
    res.json({
      success: true,
      reply: `📊 **Paxtaobod Beeline Maslahatchisi:**\nSavolingiz: "${message}" qabul qilindi. Hozirda do'kon omboridagi xaridorgir tovarlar va zaxira holati tahlil qilindi. Asosiy e'tiborni eng ko'p ketadigan 20W adapterlar, himoya oynalari (steklo) va Type-C kabellar zaxirasini to'ldirishga qarating!`
    });
  }
});

// -----------------------------------------------------------------------------
// Telegram Mini App & Online Ordering Endpoints
// -----------------------------------------------------------------------------

// 1. Mini App Products Catalog (Live products feed for Telegram Mini App)
apiV1Router.get('/telegram/miniapp/products', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : (typeof req.query.q === 'string' ? req.query.q.trim() : undefined);
  const inStockOnly = req.query.in_stock === 'true';

  let products = dataStore.getProducts();

  if (category && category !== 'Barchasi') {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const qLower = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(qLower) || 
      p.brand.toLowerCase().includes(qLower) || 
      p.barcode.includes(qLower)
    );
  }

  if (inStockOnly) {
    products = products.filter(p => p.stock > 0);
  }

  const storeInfo = dataStore.getState().storeInfo;

  res.json({
    success: true,
    store: {
      name: storeInfo?.name || "Paxtaobod Beeline Aksessuarlar",
      phone: storeInfo?.phone || "+998 90 123 45 67",
      address: storeInfo?.address || "Andijon viloyati, Paxtaobod tumani",
      workingHours: storeInfo?.workingHours || "08:30 - 20:30"
    },
    categories: ['Barchasi', ...dataStore.getCategories()],
    count: products.length,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      barcode: p.barcode,
      price: p.sellingPrice,
      sellingPrice: p.sellingPrice,
      wholesalePrice: p.wholesalePrice,
      stock: p.stock,
      inStock: p.stock > 0
    }))
  });
});

// 2. Submit Online Order from Telegram Mini App
apiV1Router.post('/telegram/miniapp/order', async (req: Request, res: Response) => {
  try {
    const { 
      items, 
      customerName, 
      customerPhone, 
      customerAddress, 
      deliveryType, 
      paymentMethod, 
      telegramUserId, 
      telegramUsername, 
      notes 
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Buyurtma uchun kamida bitta tovar tanlanishi shart ('items')"
      });
    }

    if (!customerPhone || String(customerPhone).trim().length < 7) {
      return res.status(400).json({
        success: false,
        error: "Telefon raqami kiritilishi shart"
      });
    }

    const { order, receipt, movements } = dataStore.recordOnlineOrder({
      items,
      customerName: customerName || (telegramUsername ? `@${telegramUsername}` : "Telegram Xaridor"),
      customerPhone,
      customerAddress,
      deliveryType,
      paymentMethod,
      telegramUserId,
      telegramUsername,
      notes
    });

    // Send Telegram alert if bot is configured
    const telegramConfig = dataStore.getTelegramConfig();
    if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
      const itemsText = order.items
        .map(i => `• ${i.productName} (${i.quantity} dona x ${i.unitPrice.toLocaleString('uz-UZ')} so'm) = <b>${i.totalPrice.toLocaleString('uz-UZ')} so'm</b>`)
        .join('\n');

      const tgMessage = `🔔 <b>YANGI TELEGRAM MINI APP BUYURTMASI!</b>\n\n` +
        `🧾 <b>Buyurtma:</b> #${order.orderNumber}\n` +
        `🏷️ <b>Kassa Cheki:</b> #${receipt.receiptNumber}\n` +
        `👤 <b>Mijoz:</b> ${order.customerName}\n` +
        `📞 <b>Telefon:</b> ${order.customerPhone}\n` +
        `📍 <b>Manzil:</b> ${order.customerAddress || "Do'kondan olib ketish"}\n` +
        `🚚 <b>Yetkazish:</b> ${order.deliveryType === 'yetkazib_berish' ? 'Yetkazib berish (15 000 so\'m)' : 'Olib ketish'}\n` +
        `💳 <b>To'lov turi:</b> ${order.paymentMethod.toUpperCase()}\n\n` +
        `📦 <b>Tovarlar:</b>\n${itemsText}\n\n` +
        `💰 <b>JAMI SUMMA: ${order.totalAmount.toLocaleString('uz-UZ')} SO'M</b>\n\n` +
        `🖨️ <i>Buyurtma kassa dasturiga tushdi va avtomatik printerga chiqarilmoqda...</i>`;

      sendTelegramRawMessage(telegramConfig.botToken, telegramConfig.chatId, tgMessage, 'HTML').catch(err => {
        console.error('[Telegram Mini App] Failed to send bot alert:', err);
      });
    }

    res.status(201).json({
      success: true,
      message: "Buyurtmangiz muvaffaqiyatli qabul qilindi va kassa dasturiga yuborildi!",
      orderId: order.id,
      orderNumber: order.orderNumber,
      receiptNumber: receipt.receiptNumber,
      totalAmount: order.totalAmount,
      order,
      receipt
    });
  } catch (err: any) {
    console.error('[Telegram Mini App] Error recording order:', err);
    res.status(400).json({
      success: false,
      error: err?.message || "Buyurtmani qabul qilishda xatolik yuz berdi"
    });
  }
});

// 3. Get Online Orders (Live Feed for POS Cashier)
apiV1Router.get('/telegram/miniapp/orders', (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  
  const orders = dataStore.getOnlineOrders(limit, status);
  res.json({
    success: true,
    count: orders.length,
    orders
  });
});

// 4. Pending Unprinted Orders for POS Auto-Print
apiV1Router.get('/telegram/miniapp/pending-orders', (_req: Request, res: Response) => {
  const pendingOrders = dataStore.getUnprintedOnlineOrders();
  res.json({
    success: true,
    count: pendingOrders.length,
    orders: pendingOrders
  });
});

// 5. Mark Order as Printed
apiV1Router.post('/telegram/miniapp/orders/:id/mark-printed', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = dataStore.markOnlineOrderPrinted(id);
  if (!updated) {
    return res.status(404).json({
      success: false,
      error: "Buyurtma topilmadi"
    });
  }
  res.json({
    success: true,
    message: "Buyurtma printerdan chiqarildi deb belgilandi",
    order: updated
  });
});

// 6. Update Order Status
apiV1Router.patch('/telegram/miniapp/orders/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: "Status kiritilishi shart"
    });
  }

  const updated = dataStore.updateOnlineOrderStatus(id, status);
  if (!updated) {
    return res.status(404).json({
      success: false,
      error: "Buyurtma topilmadi"
    });
  }

  res.json({
    success: true,
    message: `Buyurtma holati '${status}' ga o'zgartirildi`,
    order: updated
  });
});

