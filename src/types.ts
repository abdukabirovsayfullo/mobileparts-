export type MovementType = 'kirim' | 'chiqim' | 'spisaniye' | 'vazvrat';

export type PaymentMethod = 'naqd' | 'click_payme' | 'uzum' | 'nasiya';

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  barcode: string;
  purchasePrice: number;  // Tan narxi (kelish narxi)
  costPrice?: number;     // Alias
  wholesalePrice?: number; // Optom (ulgurji) sotish narxi
  sellingPrice: number;   // Chakana sotish narxi
  stock: number;          // Ombordagi joriy qoldiq
  minStockAlert: number;  // Kam qolish chegarasi
}

export interface StockMovement {
  id: string;
  type: MovementType;     // 'kirim' (tovar kirdi) yoki 'chiqim' (tovar chiqdi / sotildi)
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitCost: number;       // Tan narxi
  unitPrice: number;      // Sotish narxi (kirimda tan narxiga teng bo'lishi mumkin)
  priceType?: 'chakana' | 'optom' | 'maxsus';
  discountAmount?: number;// Qilingan chegirma summasi
  totalCost: number;      // Jami tan narx (unitCost * quantity)
  totalRevenue: number;   // Jami tushum (unitPrice * quantity - discount)
  profit: number;         // Sof foyda = totalRevenue - totalCost
  timestamp: string;      // ISO sana-vaqt
  paymentMethod?: PaymentMethod;
  counterparty: string;   // Kimdan keldi (Ta'minotchi) yoki Kimga sotildi (Mijoz)
  customerPhone?: string; // Mijoz telefon raqami
  customerAddress?: string; // Qayerga sotildi (Manzil / Joylashuv)
  receiptNumber?: string; // Chek / Kvitansiya raqami
  batchSaleId?: string;   // Bitta savatdagi barcha tovarlar uchun umumiy ID
  originalMovementId?: string; // Qaytarilgan dastlabki sotuv (chiqim) ID si
  returnReason?: string;  // Tovar qaytarilish sababi
  isReturn?: boolean;     // Qaytarilgan tovar belgisi
  notes?: string;
}

export interface StoreSettings {
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  phone2?: string;
  accountantName: string;
  workingHours?: string;
  adminPin?: string;
}

export interface SaleReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string; // Qayerga sotildi
  paymentMethod: PaymentMethod;
  items: {
    id?: string;
    name: string;
    category?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount?: number;
  total: number;
  paidAmount?: number;
  changeAmount?: number;
  notes?: string;
  cashierName?: string;
  isDebt?: boolean;
  debtRemaining?: number;
  debtDueDate?: string;
  isReturn?: boolean;
  returnReason?: string;
  showPrices?: boolean; // Narxlar ko'rinishi (o'chirilsa faqat tovar nomi, toifasi va soni qoladi)
}

export interface DebtRecord {
  id: string;
  movementId?: string;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  createdAt: string;
  status: 'faol' | 'qisman_tolandi' | 'yopildi';
  notes?: string;
  paymentHistory?: {
    date: string;
    amount: number;
    method: 'naqd' | 'click_payme';
  }[];
}

export interface SupplierPaymentEntry {
  id: string;
  date: string;
  amount: number;
  method: 'naqd' | 'karta' | 'hisob_raqam';
  notes?: string;
}

export interface SupplierDebtRecord {
  id: string;
  supplierName: string;          // Ta'minotchi yoki diler nomi (masalan: Abu Saxiy Remax, Malika optom)
  supplierPhone?: string;        // Telefon raqami
  productSummary: string;        // Olingan tovarlar yoki partiya tavsifi
  totalDebt: number;             // Jami tovarlar qiymati (tan narx bo'yicha)
  paidAmount: number;            // To'langan qismi
  remainingAmount: number;       // Ta'minotchiga qolgan qarzimiz
  dueDate?: string;              // To'lash / qaytarish sanasi
  createdAt: string;             // Olingan sana
  status: 'faol' | 'qisman_tolandi' | 'yopildi';
  notes?: string;
  paymentHistory?: SupplierPaymentEntry[];
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  createdAt?: string;
  lastVisit?: string;
}

export interface DailySummary {
  date: string;
  totalKirimCost: number;
  totalKirimQuantity: number;
  totalChiqimRevenue: number;
  totalChirimCost: number;
  totalProfit: number;
  totalChiqimQuantity: number;
  cashRevenue: number;
  clickRevenue: number;
  debtRevenue: number;
}

export interface OrderItem {
  id: string;
  name: string;
  category: string;
  model: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  currentStock: number;
  selected: boolean;
  notes?: string;
  barcode?: string;
  supplier?: string;
  isCustom?: boolean;
}

export interface ParsedInvoiceItem {
  id: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  category: string;
  brand?: string;
  rawLine?: string;
  matchedProductId?: string;
  selected: boolean;
}

export interface ParsedInvoiceResult {
  supplier?: string;
  date?: string;
  totalSum?: number;
  notes?: string;
  items: ParsedInvoiceItem[];
}

export type OnlineOrderStatus = 'yangi' | 'qabul_qilindi' | 'chiqarildi' | 'yetkazilmoqda' | 'bajarildi' | 'bekor_qilindi';

export interface OnlineOrderItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode?: string;
  brand?: string;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  receiptNumber: string;
  source: 'telegram_miniapp' | 'telegram_bot' | 'web';
  status: OnlineOrderStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  telegramUserId?: string | number;
  telegramUsername?: string;
  paymentMethod: PaymentMethod;
  deliveryType: 'olib_ketish' | 'yetkazib_berish';
  items: OnlineOrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  notes?: string;
  isPrinted: boolean;
  printedAt?: string;
}

export interface TelegramMiniAppOrderPayload {
  items: Array<{
    productId?: string;
    productName?: string;
    category?: string;
    barcode?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  deliveryType?: 'olib_ketish' | 'yetkazib_berish';
  paymentMethod?: PaymentMethod;
  telegramUserId?: string | number;
  telegramUsername?: string;
  notes?: string;
}
