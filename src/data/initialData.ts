import { Product, StockMovement, DebtRecord, CustomerProfile, SupplierDebtRecord, StoreSettings } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'iPhone 15 Pro Max MagSafe Silikon Chexol (Qora)',
    category: 'Chexollar',
    brand: 'Apple OEM',
    barcode: '478001',
    purchasePrice: 45000,
    wholesalePrice: 65000,
    sellingPrice: 85000,
    stock: 22,
    minStockAlert: 5
  },
  {
    id: 'prod-2',
    name: 'Remax 20W PD Type-C Tezkor Quvvatlagich (Adapter)',
    category: 'Zaryadniklar',
    brand: 'Remax',
    barcode: '478002',
    purchasePrice: 55000,
    wholesalePrice: 85000,
    sellingPrice: 110000,
    stock: 18,
    minStockAlert: 5
  },
  {
    id: 'prod-3',
    name: 'KingKong 21D Keramika Himoya Oynasi (Universal)',
    category: 'Himoya Oynalari',
    brand: 'KingKong',
    barcode: '478003',
    purchasePrice: 12000,
    wholesalePrice: 22000,
    sellingPrice: 35000,
    stock: 45,
    minStockAlert: 15
  },
  {
    id: 'prod-4',
    name: 'Hoco EW51 ANC Simsiz Quloqchin (AirPods Pro)',
    category: 'Quloqchinlar',
    brand: 'Hoco',
    barcode: '478004',
    purchasePrice: 120000,
    wholesalePrice: 170000,
    sellingPrice: 220000,
    stock: 8,
    minStockAlert: 3
  },
  {
    id: 'prod-5',
    name: 'Baseus 20000mAh 22.5W Tezkor Powerbank',
    category: 'Powerbanklar',
    brand: 'Baseus',
    barcode: '478005',
    purchasePrice: 180000,
    wholesalePrice: 235000,
    sellingPrice: 285000,
    stock: 6,
    minStockAlert: 3
  },
  {
    id: 'prod-6',
    name: 'Borofone 100W 3-in-1 Mato Qoplamali USB Kabel',
    category: 'Kabellar',
    brand: 'Borofone',
    barcode: '478006',
    purchasePrice: 22000,
    wholesalePrice: 35000,
    sellingPrice: 50000,
    stock: 32,
    minStockAlert: 10
  },
  {
    id: 'prod-7',
    name: 'Baseus MagSafe Avtomobil Telefon Ushlagichi (Holdar)',
    category: 'Avto Aksessuarlar',
    brand: 'Baseus',
    barcode: '478007',
    purchasePrice: 65000,
    wholesalePrice: 95000,
    sellingPrice: 130000,
    stock: 7,
    minStockAlert: 3
  },
  {
    id: 'prod-8',
    name: 'Samsung Galaxy A15 / A25 Shaffof Zarbaga Chidamli Chexol',
    category: 'Chexollar',
    brand: 'Space Tech',
    barcode: '478008',
    purchasePrice: 25000,
    wholesalePrice: 38000,
    sellingPrice: 55000,
    stock: 24,
    minStockAlert: 5
  },
  {
    id: 'prod-9',
    name: 'Redmi Note 13 Pro Matoviy Maxfiy (Privacy) Oyna',
    category: 'Himoya Oynalari',
    brand: 'Anti-Spy',
    barcode: '478009',
    purchasePrice: 18000,
    wholesalePrice: 30000,
    sellingPrice: 45000,
    stock: 14,
    minStockAlert: 5
  },
  {
    id: 'prod-10',
    name: 'Beeline Yangi SIM-karta (ZOR Tarif to\'plami)',
    category: 'Beeline Xizmatlari',
    brand: 'Beeline UZ',
    barcode: '478010',
    purchasePrice: 20000,
    wholesalePrice: 35000,
    sellingPrice: 50000,
    stock: 35,
    minStockAlert: 10
  }
];

// Today's date helper
const now = new Date();
const todayISO = now.toISOString();
const twoHoursAgoISO = new Date(now.getTime() - 2 * 3600000).toISOString();
const fourHoursAgoISO = new Date(now.getTime() - 4 * 3600000).toISOString();
const yesterdayISO = new Date(now.getTime() - 86400000).toISOString();
const twoDaysAgoISO = new Date(now.getTime() - 2 * 86400000).toISOString();

export const INITIAL_MOVEMENTS: StockMovement[] = [
  // Bugungi tovar kirimi (Ta'minotchidan keldi)
  {
    id: 'mov-001',
    type: 'kirim',
    productId: 'prod-3',
    productName: 'KingKong 21D Keramika Himoya Oynasi (Universal)',
    category: 'Himoya Oynalari',
    quantity: 30,
    unitCost: 12000,
    unitPrice: 35000,
    totalCost: 360000,
    totalRevenue: 360000,
    profit: 0,
    timestamp: fourHoursAgoISO,
    counterparty: 'Andijon Ulgurji Baza (Boburshoh)',
    notes: 'Yangi partiya keramika oynalar'
  },
  {
    id: 'mov-002',
    type: 'kirim',
    productId: 'prod-2',
    productName: 'Remax 20W PD Type-C Tezkor Quvvatlagich (Adapter)',
    category: 'Zaryadniklar',
    quantity: 15,
    unitCost: 55000,
    unitPrice: 110000,
    totalCost: 825000,
    totalRevenue: 825000,
    profit: 0,
    timestamp: fourHoursAgoISO,
    counterparty: 'Toshkent Abu Saxiy Ta\'minotchi',
    notes: '20W original zaryadlovchilar'
  },

  // Bugungi tovar chiqimi (Sotuvlar)
  {
    id: 'mov-003',
    type: 'chiqim',
    productId: 'prod-1',
    productName: 'iPhone 15 Pro Max MagSafe Silikon Chexol (Qora)',
    category: 'Chexollar',
    quantity: 2,
    unitCost: 45000,
    unitPrice: 85000,
    totalCost: 90000,
    totalRevenue: 170000,
    profit: 80000, // 170 000 - 90 000 = 80 000 sof foyda!
    timestamp: twoHoursAgoISO,
    paymentMethod: 'click_payme',
    counterparty: 'Otabek Mirzayev (Mijoz)',
    notes: 'Joyida o\'rnatib berildi'
  },
  {
    id: 'mov-004',
    type: 'chiqim',
    productId: 'prod-2',
    productName: 'Remax 20W PD Type-C Tezkor Quvvatlagich (Adapter)',
    category: 'Zaryadniklar',
    quantity: 1,
    unitCost: 55000,
    unitPrice: 110000,
    totalCost: 55000,
    totalRevenue: 110000,
    profit: 55000,
    timestamp: twoHoursAgoISO,
    paymentMethod: 'naqd',
    counterparty: 'Javohirbek (Mijoz)',
    notes: 'Naqd pul tushdi'
  },
  {
    id: 'mov-005',
    type: 'chiqim',
    productId: 'prod-3',
    productName: 'KingKong 21D Keramika Himoya Oynasi (Universal)',
    category: 'Himoya Oynalari',
    quantity: 3,
    unitCost: 12000,
    unitPrice: 35000,
    totalCost: 36000,
    totalRevenue: 105000,
    profit: 69000,
    timestamp: todayISO,
    paymentMethod: 'naqd',
    counterparty: 'Paxtaobod bozor xaridorlari',
    notes: '3 ta telefon oynasi yopishtirildi'
  },
  {
    id: 'mov-006',
    type: 'chiqim',
    productId: 'prod-5',
    productName: 'Baseus 20000mAh 22.5W Tezkor Powerbank',
    category: 'Powerbanklar',
    quantity: 1,
    unitCost: 180000,
    unitPrice: 285000,
    totalCost: 180000,
    totalRevenue: 285000,
    profit: 105000,
    timestamp: todayISO,
    paymentMethod: 'nasiya',
    counterparty: 'Akromjon Qo\'shni (Nasiya)',
    notes: '85 000 naqd berdi, qoldiq 200 000 nasiya'
  },

  // Kechagi chiqimlar (Kechagi hisobot uchun)
  {
    id: 'mov-007',
    type: 'chiqim',
    productId: 'prod-4',
    productName: 'Hoco EW51 ANC Simsiz Quloqchin (AirPods Pro)',
    category: 'Quloqchinlar',
    quantity: 1,
    unitCost: 120000,
    unitPrice: 220000,
    totalCost: 120000,
    totalRevenue: 220000,
    profit: 100000,
    timestamp: yesterdayISO,
    paymentMethod: 'click_payme',
    counterparty: 'Dilshodbek (Mijoz)'
  },
  {
    id: 'mov-008',
    type: 'chiqim',
    productId: 'prod-6',
    productName: 'Borofone 100W 3-in-1 Mato Qoplamali USB Kabel',
    category: 'Kabellar',
    quantity: 2,
    unitCost: 22000,
    unitPrice: 50000,
    totalCost: 44000,
    totalRevenue: 100000,
    profit: 56000,
    timestamp: yesterdayISO,
    paymentMethod: 'naqd',
    counterparty: 'Sardorbek (Mijoz)'
  },
  {
    id: 'mov-009',
    type: 'chiqim',
    productId: 'prod-10',
    productName: 'Beeline Yangi SIM-karta (ZOR Tarif to\'plami)',
    category: 'Beeline Xizmatlari',
    quantity: 3,
    unitCost: 20000,
    unitPrice: 50000,
    totalCost: 60000,
    totalRevenue: 150000,
    profit: 90000,
    timestamp: twoDaysAgoISO,
    paymentMethod: 'naqd',
    counterparty: 'Beeline abonentlari'
  }
];

export const INITIAL_DEBTS: DebtRecord[] = [
  {
    id: 'debt-1',
    movementId: 'mov-006',
    customerName: 'Akromjon Qo\'shni',
    customerPhone: '+998 90 555 44 33',
    totalDebt: 285000,
    paidAmount: 85000,
    remainingAmount: 200000,
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    createdAt: todayISO,
    status: 'qisman_tolandi',
    notes: 'Baseus 20000mAh Powerbank uchun olingan, 20-sanada to\'laydi.',
    paymentHistory: [
      {
        date: todayISO,
        amount: 85000,
        method: 'naqd'
      }
    ]
  },
  {
    id: 'debt-2',
    customerName: 'Rustambek Aka (Usta)',
    customerPhone: '+998 91 444 88 99',
    totalDebt: 150000,
    paidAmount: 0,
    remainingAmount: 150000,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    createdAt: yesterdayISO,
    status: 'faol',
    notes: '2 ta zaryadlovchi kabel va bron oyna olingan.'
  }
];

export const INITIAL_SUPPLIER_DEBTS: SupplierDebtRecord[] = [
  {
    id: 'supp-debt-1',
    supplierName: 'Abu Saxiy "Grand Mobile" Diler',
    supplierPhone: '+998 90 123 45 67',
    productSummary: 'Remax 20W Quvvatlagich (20 ta), Borofone Type-C Kabel (30 ta)',
    totalDebt: 1760000,
    paidAmount: 760000,
    remainingAmount: 1000000,
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    createdAt: yesterdayISO,
    status: 'qisman_tolandi',
    notes: 'Kirim partiyasi #104. 760 000 so\'m naqd berildi, 1 000 000 so\'m 5 kundan keyin beriladi.',
    paymentHistory: [
      {
        id: 'spay-1',
        date: yesterdayISO,
        amount: 760000,
        method: 'naqd',
        notes: 'Tovar tushirilganda avans to\'landi'
      }
    ]
  },
  {
    id: 'supp-debt-2',
    supplierName: 'Malika Bozor "Aksessuar Optom" (Shavkat aka)',
    supplierPhone: '+998 97 333 22 11',
    productSummary: 'KingKong 21D Shisha (50 ta), AirPods Pro Chexol (15 ta)',
    totalDebt: 850000,
    paidAmount: 0,
    remainingAmount: 850000,
    dueDate: new Date(Date.now() + 86400000 * 8).toISOString().slice(0, 10),
    createdAt: todayISO,
    status: 'faol',
    notes: 'To\'liq nasiyaga olingan, keyingi haftada to\'lanadi.'
  }
];

export const INITIAL_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'cust-1',
    name: "Akromjon Qo'shni",
    phone: '+998 90 555 44 33',
    address: "Paxtaobod markaz, Qo'shni do'kon",
    notes: 'Doimiy xaridor, powerbank va kabellar oladi',
    createdAt: todayISO,
    lastVisit: todayISO
  },
  {
    id: 'cust-2',
    name: 'Rustambek Aka (Usta)',
    phone: '+998 91 444 88 99',
    address: 'Paxtaobod dehqon bozori, Telefon remont usta',
    notes: 'Usta, oynalar va zaryadlovchilar oladi',
    createdAt: yesterdayISO,
    lastVisit: yesterdayISO
  },
  {
    id: 'cust-3',
    name: 'Dilshodbek (Mijoz)',
    phone: '+998 93 111 22 33',
    address: 'Paxtaobod, Madaniyat MFY',
    notes: 'Hoco naushnik xaridori',
    createdAt: yesterdayISO,
    lastVisit: yesterdayISO
  },
  {
    id: 'cust-4',
    name: 'Sardorbek (Mijoz)',
    phone: '+998 97 777 66 55',
    address: 'Paxtaobod tuman shifoxona atrofi',
    notes: 'Kabel va chexollar oladi',
    createdAt: yesterdayISO,
    lastVisit: yesterdayISO
  },
  {
    id: 'cust-5',
    name: 'Otabek Taksist',
    phone: '+998 99 888 12 34',
    address: 'Paxtaobod Avtovokzal bekat',
    notes: 'Avto ushlagich va zaryadnik olgan',
    createdAt: twoDaysAgoISO,
    lastVisit: twoDaysAgoISO
  }
];

export const DEFAULT_CATEGORIES: string[] = [
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

export const STORE_INFO: StoreSettings = {
  name: 'MOBILE PARTS',
  tagline: 'Telefon ehtiyot qismlari va aksessuarlar markazi',
  address: "Z. Habibiy ko'chasi, Yoqubov stoyankasi to'g'risida, Beeline ofisi",
  phone: '+998 95 200 13 33, +998 91 174 13 33',
  phone2: '+998 91 174 13 33',
  accountantName: 'Sayfullo (Hisobchi / Kassir)',
  workingHours: '08:00 - 20:00',
};
