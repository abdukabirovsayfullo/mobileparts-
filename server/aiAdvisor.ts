import { GoogleGenAI } from '@google/genai';
import { dataStore } from './dataStore';
import { Product, StockMovement, DebtRecord } from '../src/types';

// Lazy initialization of GoogleGenAI
let defaultGeminiClient: GoogleGenAI | null = null;

function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const key = (customApiKey || '').trim() || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!customApiKey && defaultGeminiClient) {
    return defaultGeminiClient;
  }
  const client = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  if (!customApiKey) {
    defaultGeminiClient = client;
  }
  return client;
}

export interface RecommendationItem {
  productId: string;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  recommendedOrderQuantity: number;
  estimatedCost: number;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface DeadStockItem {
  productId: string;
  name: string;
  category: string;
  currentStock: number;
  tiedUpCapital: number;
  reason: string;
  action: string;
}

export interface DetectedMistake {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  impact: string;
  explanation: string;
  solution: string;
}

export interface AiAuditReport {
  generatedAt: string;
  storeName: string;
  metrics: {
    totalProducts: number;
    outOfStockCount: number;
    lowStockCount: number;
    deadStockCount: number;
    totalDeadStockCapital: number;
    totalActiveDebts: number;
    debtExposureSum: number;
    averageMarginPercent: number;
  };
  mistakes: DetectedMistake[];
  procurementPlan: {
    orderMore: RecommendationItem[];
    orderLessOrStop: DeadStockItem[];
    totalRecommendedOrderSum: number;
    totalRecommendedItemsCount: number;
  };
  goldenRules: string[];
  executiveSummary: string;
  usedAiModel?: string;
}

/**
 * Calculates deterministic statistics and heuristic recommendations.
 */
export function computeStoreAuditData(): {
  audit: AiAuditReport;
  rawStats: any;
} {
  const state = dataStore.getState();
  const products = state.products || [];
  const movements = state.movements || [];
  const debts = state.debts || [];
  const storeName = state.storeInfo?.name || 'Paxtaobod Beeline';

  // 1. Calculate sales count and revenue per product from movements
  const salesMap: Record<string, { quantity: number; revenue: number; profit: number }> = {};
  movements.forEach(m => {
    if (m.type === 'chiqim') {
      const pid = m.productId || m.productName;
      if (!salesMap[pid]) {
        salesMap[pid] = { quantity: 0, revenue: 0, profit: 0 };
      }
      salesMap[pid].quantity += Number(m.quantity || 0);
      salesMap[pid].revenue += Number(m.totalRevenue || 0);
      salesMap[pid].profit += Number(m.profit || 0);
    }
  });

  // 2. Identify products status
  const outOfStockProducts: Product[] = [];
  const lowStockProducts: Product[] = [];
  const fastMovers: Array<{ product: Product; sold: number; profit: number }> = [];
  const deadStock: Array<{ product: Product; tiedCapital: number }> = [];

  let totalInventoryCost = 0;
  let totalInventoryRetail = 0;

  products.forEach(p => {
    const cost = Number(p.purchasePrice || p.costPrice || 0);
    const retail = Number(p.sellingPrice || 0);
    const stock = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);

    totalInventoryCost += cost * stock;
    totalInventoryRetail += retail * stock;

    const sales = salesMap[p.id] || salesMap[p.name] || { quantity: 0, revenue: 0, profit: 0 };

    if (stock <= 0) {
      outOfStockProducts.push(p);
    } else if (stock <= minAlert) {
      lowStockProducts.push(p);
    }

    if (sales.quantity >= 3) {
      fastMovers.push({ product: p, sold: sales.quantity, profit: sales.profit });
    } else if (stock >= 5 && sales.quantity === 0) {
      deadStock.push({ product: p, tiedCapital: cost * stock });
    }
  });

  // Sort fast movers by sales count descending
  fastMovers.sort((a, b) => b.sold - a.sold);
  deadStock.sort((a, b) => b.tiedCapital - a.tiedCapital);

  // Debts statistics
  const activeDebts = debts.filter(d => d.status === 'faol' || d.status === 'qisman_tolandi');
  const totalDebtSum = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);

  // Margins
  const margins = products
    .filter(p => p.sellingPrice > 0 && p.purchasePrice > 0)
    .map(p => ((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100);
  const avgMargin = margins.length > 0 ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : 40;

  // 3. Build Detected Mistakes
  const mistakes: DetectedMistake[] = [];

  // Mistake 1: Stockout of top products
  if (outOfStockProducts.length > 0) {
    const criticalNames = outOfStockProducts.slice(0, 4).map(p => p.name).join(', ');
    mistakes.push({
      title: "Xaridorgir tovarlar tugab qolishi (Lost Sales / Mijoz yo'qotish)",
      severity: 'critical',
      impact: `${outOfStockProducts.length} ta tovar omborda 0 qolgan`,
      explanation: `Mijozlar do'konga kelganda eng kerakli aksessuarlarni topolmay boshqa do'konga ketmoqda. Hozirda quyidagilar tugagan: ${criticalNames}. Bu to'g'ridan-to'g'ri daromadni boy berish demakdir.`,
      solution: "Eng tez aylanadigan A-toifa tovarlar uchun minimal chegara (minStockAlert) ni kamida 8-10 donaga ko'taring va zaxira 5 tadan kamayganda darhol buyurtma bering."
    });
  }

  // Mistake 2: Dead stock tying up capital
  const totalDeadCapital = deadStock.reduce((s, d) => s + d.tiedCapital, 0);
  if (deadStock.length > 0 && totalDeadCapital > 0) {
    mistakes.push({
      title: "O'lik zaxiraga mablag' muzlatish (Dead Capital)",
      severity: 'warning',
      impact: `${totalDeadCapital.toLocaleString('uz-UZ')} so'mlik pul qotib yotibdi (${deadStock.length} ta tovar)`,
      explanation: "Oylardan beri sotilmayotgan yoki eskirgan telefon modellari (masalan, eski rusum chexollari) omborda joy va naqd pulni band qilib turibdi. Bu mablag'ni yangi iPhone/Redmi aksessuarlariga yo'naltirish mumkin edi.",
      solution: "Ushbu tovarlarni tannarxida yoki '1+1 chegirma' aksiyasi bilan zudlik bilan naqdga aylantiring. Keyingi partiyalarda ushbu toifalardan zakaz qilishni to'xtating."
    });
  }

  // Mistake 3: Debt exposure
  if (totalDebtSum > 1000000) {
    mistakes.push({
      title: "Nasiya ulushining ortib ketishi (Likvidlik xatari)",
      severity: 'warning',
      impact: `${totalDebtSum.toLocaleString('uz-UZ')} so'm to'lanmagan nasiyalar mavjud`,
      explanation: "Nasiya daftarda yig'ilib qolgan summa tufayli yangi partiya tovarlarni dilerlardan arzonroq (optom naqd) olish imkoniyati cheklanmoqda.",
      solution: "Nasiya berishni cheklang, har bir mijozga aniq qaytarish muddati (maksimal 7-10 kun) qo'ying va Telegram/SMS eslatmalar orqali eski qarzlarni yig'ib oling."
    });
  }

  // Mistake 4: Low margins
  const lowMarginProducts = products.filter(p => {
    const cost = Number(p.purchasePrice || p.costPrice || 0);
    const sell = Number(p.sellingPrice || 0);
    return sell > 0 && cost > 0 && ((sell - cost) / sell) < 0.25;
  });
  if (lowMarginProducts.length > 0) {
    mistakes.push({
      title: "Ayrim tovarlarda marjaning o'ta pastligi (< 25%)",
      severity: 'info',
      impact: `${lowMarginProducts.length} ta tovar past foyda bilan sotilmoqda`,
      explanation: "Telefon aksessuarlarida chakana marja odatda 40-60% bo'lishi kerak. 25% dan past marja do'kon ijarasi va xarajatlarini qoplashda foydani kamaytiradi.",
      solution: "Ushbu tovarlarning chakana narxini 10-15% ga oshiring yoki to'g'ridan-to'g'ri birinchi qo'l dilerlardan arzonroq partiya toping."
    });
  }

  // 4. Procurement Plan: What to order MORE
  const orderMoreList: RecommendationItem[] = [];
  
  // A) Combine out of stock + low stock + fast movers
  const priorityProducts = [...outOfStockProducts, ...lowStockProducts];
  fastMovers.forEach(fm => {
    if (!priorityProducts.some(p => p.id === fm.product.id)) {
      if (fm.product.stock <= 10) {
        priorityProducts.push(fm.product);
      }
    }
  });

  priorityProducts.forEach(p => {
    const cost = Number(p.purchasePrice || p.costPrice || 0);
    const stock = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);
    const sales = salesMap[p.id]?.quantity || 0;

    // Recommended order: target at least 20-30 units for bestsellers, 15 for normal
    const targetStock = Math.max(15, minAlert * 3 + sales * 2);
    const orderQty = Math.max(10, targetStock - stock);

    orderMoreList.push({
      productId: p.id,
      name: p.name,
      category: p.category,
      currentStock: stock,
      minStockAlert: minAlert,
      recommendedOrderQuantity: orderQty,
      estimatedCost: orderQty * cost,
      reason: stock === 0 
        ? "Omborda mutlaqo tugagan! Talab yuqori, xaridor yo'qotmaslik uchun shoshilinch zakaz qilish shart."
        : stock <= minAlert
          ? `Zaxira chegaraga yetdi (${stock} dona). Tez orada tugaydi.`
          : `Do'kondagi xaridorgir tovar (oylik savdo: ${sales} dona). Zaxirani barqaror ushlash kerak.`,
      urgency: stock === 0 ? 'high' : stock <= minAlert ? 'high' : 'medium'
    });
  });

  // Sort by urgency then estimatedCost
  orderMoreList.sort((a, b) => {
    if (a.urgency === 'high' && b.urgency !== 'high') return -1;
    if (b.urgency === 'high' && a.urgency !== 'high') return 1;
    return a.currentStock - b.currentStock;
  });

  // 5. Procurement Plan: What to order LESS or STOP
  const orderLessList: DeadStockItem[] = deadStock.slice(0, 15).map(ds => ({
    productId: ds.product.id,
    name: ds.product.name,
    category: ds.product.category,
    currentStock: ds.product.stock,
    tiedUpCapital: ds.tiedCapital,
    reason: `Omborda ${ds.product.stock} dona mavjud, lekin so'nggi paytlarda deyarli sotilmagan. Pul muzlab turibdi.`,
    action: "Umuman yangi zakaz bermang. Mavjudlarini chegirma yoki bonus sifatida sovg'a qilib tugating."
  }));

  const totalRecommendedOrderSum = orderMoreList.reduce((sum, item) => sum + item.estimatedCost, 0);
  const totalRecommendedItemsCount = orderMoreList.reduce((sum, item) => sum + item.recommendedOrderQuantity, 0);

  const goldenRules = [
    "1. A-Toifa Qoidasi: Do'konning eng ko'p sotiladigan 10 ta aksessuari (iPhone 15/16 chexollari, 20W zaryadka, Type-C kabel) omborda hech qachon 0 ga tushmasin.",
    "2. 70/30 Pul Taqsimoti: Har doim yangi zakaz byudjetining 70% ini kafolatlangan tez ketadigan tovarlarga, faqat 30% ini yangi test modellarga ajrating.",
    "3. Muzlatilgan Pul Qoidasi: Bir oy davomida bitta ham sotilmagan modeldan qaytib zakaz qilmang.",
    "4. Nasiya Chegarasi: Nasiyalar summasi do'konning 1 oylik sof foydasidan oshmasligi shart, aks holda yangi tovar keltirishga mablag' yetmay qoladi."
  ];

  const executiveSummary = `Do'konda jami ${products.length} ta aksessuar toifalari mavjud. Eng muhim vazifa: omborda 0 qolgan ${outOfStockProducts.length} ta xaridorgir tovarlarni zudlik bilan to'ldirish va qotib qolgan ${deadStock.length} ta o'lik tovarlarni aksiyalar bilan naqdga aylantirish. Tavsiya etilgan jami zakaz partiyasi: ~${totalRecommendedOrderSum.toLocaleString('uz-UZ')} so'm (${totalRecommendedItemsCount} dona).`;

  const report: AiAuditReport = {
    generatedAt: new Date().toISOString(),
    storeName,
    metrics: {
      totalProducts: products.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockCount: lowStockProducts.length,
      deadStockCount: deadStock.length,
      totalDeadStockCapital: totalDeadCapital,
      totalActiveDebts: activeDebts.length,
      debtExposureSum: totalDebtSum,
      averageMarginPercent: avgMargin
    },
    mistakes,
    procurementPlan: {
      orderMore: orderMoreList.slice(0, 15),
      orderLessOrStop: orderLessList,
      totalRecommendedOrderSum,
      totalRecommendedItemsCount
    },
    goldenRules,
    executiveSummary
  };

  return {
    audit: report,
    rawStats: {
      productsCount: products.length,
      outOfStock: outOfStockProducts.map(p => ({ id: p.id, name: p.name, cost: p.purchasePrice, price: p.sellingPrice })),
      fastMovers: fastMovers.slice(0, 10).map(f => ({ name: f.product.name, sold: f.sold })),
      deadStock: deadStock.slice(0, 10).map(d => ({ name: d.product.name, stock: d.product.stock, tied: d.tiedCapital })),
      totalDebtSum,
      avgMargin
    }
  };
}

/**
 * Generates an intelligent, domain-specific advisor response based on live store data.
 * This runs seamlessly if Gemini is offline, unavailable, or quota exhausted (429 RESOURCE_EXHAUSTED).
 */
export function generateLocalStoreAdvisorAnswer(
  userMessage: string,
  rawStats: any,
  audit: AiAuditReport,
  products: Product[],
  movements: StockMovement[],
  debts: DebtRecord[]
): string {
  const q = userMessage.toLowerCase().trim();

  // 1. iPhone 15 & 16 cases and model purchase questions
  if (/iphone\s*(15|16)|chexol|g['`ʼ]?ilof|case|magsafe/i.test(q)) {
    const iphoneCases = products.filter(p => /iphone|chexol|case/i.test(p.name));
    const iphoneStockText = iphoneCases.length > 0
      ? `\n\n📌 **Do'koningizdagi joriy chexollar holati:**\n` +
        iphoneCases.slice(0, 6).map(c => `• ${c.name}: ${c.stock} dona qolgan (sotuv: ${Number(c.sellingPrice || 0).toLocaleString('uz-UZ')} so'm)`).join('\n')
      : '';

    return `📱 **iPhone 15 va iPhone 16 Chexollari Xaridi Bo'yicha Mutaxassis Tavsiyasi:**

Hozirgi O'zbekiston aksessuar bozorida (Andijon / Paxtaobod) iPhone 15 va 16 flagman modellari bo'yicha eng xaridorgir va aylanmasi tez to'plam:

---
### 1️⃣ iPhone 15 Seriyasi (Jami ~40 dona zakaz qilish tavsiya etiladi):
• **iPhone 15 Pro Max**: 15 dona
  - 8 dona: Shaffof MagSafe (sarg'aymaydigan akril orqa qismli) — eng ko'p so'raladi;
  - 5 dona: Matoviy silikon (Qora, Titanium kulrang, To'q ko'k);
  - 2 dona: Oyna/charm ko'rinishidagi premium variant.
• **iPhone 15 Pro**: 12 dona
  - 6 dona: Shaffof MagSafe;
  - 4 dona: Silikon qora/kulrang;
  - 2 dona: Chiroyli pastel ranglar.
• **iPhone 15 (oddiy)**: 8-10 dona (ayollarga och ranglar, erkaklarga qora/shaffof).
• **iPhone 15 Plus**: Faqat 3-4 dona (chunki bozorda Plus modeli xaridori kamroq, pulni muzlatib qo'ymang).

---
### 2️⃣ iPhone 16 Seriyasi (Jami ~35 dona zakaz qilish tavsiya etiladi):
• **iPhone 16 Pro Max**: 15 dona
  - *Muhim:* Yangi "Camera Control" (kamera sensori) tugmasi uchun qirqilgan yoki o'tkazuvchan tugmali modellardan oling!
  - 8 dona: Shaffof MagSafe;
  - 5 dona: Qora va Desert Titanium (oltin-titanium rangiga mos);
  - 2 dona: Zarbaga chidamli burchakli (Armor).
• **iPhone 16 Pro**: 12 dona (shaffof MagSafe va matoviy silikon).
• **iPhone 16 (oddiy)**: 8 dona (vertikal kamera qolipiga mos).
• **iPhone 16 Plus**: 2-3 dona (ehtiyotkorlik bilan).

---
💡 **Do'kondorlar uchun 3 ta Oltin Maslahat:**
1. **Steklo (Himoya Oynasi) bilan komplekt qiling:** Chexol olgan mijozlarning 80-90% qismi darhol yangi steklo ham qo'yadi. Har bir modelga kamida 15-20 donadan 9D/21D yoki ESD antistatik to'liq qoplovchi steklo qo'shib oling.
2. **20W/30W PD Type-C Zaryadka:** Yangi iPhone qutisida adapter chiqmaydi. Chexol olgan mijozga "Original sifatli 20W boshcha kerak emasmi?" deb taklif qilsangiz, chekingiz o'rtacha 70,000 - 120,000 so'mga o'sadi!
3. **Ranglar qoidasi:** Rang-barang, yaltiroq va naqshli chexollarni har biridan ko'pi bilan 1-2 donadan testga oling. Asosiy 80% savdoni **Shaffof (Clear)** va **Qora (Black)** chexollar beradi.${iphoneStockText}`;
  }

  // 2. Budget breakdown: 5 million or any X million so'm
  if (/million|mln|byudjet|budjet|summa.*zakaz|5\s*000\s*000/i.test(q)) {
    const numMatch = q.match(/(\d+)\s*(?:million|mln)/i);
    const budgetMillions = numMatch ? parseInt(numMatch[1], 10) : 5;
    const totalBudget = budgetMillions * 1_000_000;
    const guaranteedPart = Math.round(totalBudget * 0.70);
    const highMarginPart = Math.round(totalBudget * 0.30);

    return `💰 **${budgetMillions} Million So'mlik Xarid Byudjetini 70/30 Qoidasi Asosida Taqsimlash:**

Aksessuarlar biznesida eng xavfsiz va eng yuqori foyda keltiruvchi formula:
• **70% (${(guaranteedPart / 1_000_000).toFixed(1)} mln so'm)** — Kafolatlangan tez ketadigan asosiy aksessuarlar.
• **30% (${(highMarginPart / 1_000_000).toFixed(1)} mln so'm)** — Yuqori marjali (foydasi katta) gadjetlar.

---
📦 **1. Tez aylanuvchi tovarlar (${(guaranteedPart / 1_000_000).toFixed(1)} mln so'm):**
• **Type-C 20W PD Adapterlar (Hoco/Remax/Borofone):**
  - ~12 dona x ~35,000 so'm = **420,000 so'm** (Sotish narxi: 70,000-80,000 so'm)
• **Tezkor Zaryadka Kabellari (Type-C to Type-C va Lightning):**
  - ~30 dona x ~18,000 so'm = **540,000 so'm** (Sotish narxi: 35,000-45,000 so'm)
• **9D / 21D Himoya oynalari (Steklo):**
  - Ommabop modellarga: Samsung A15/A25/A35, Redmi Note 12/13, iPhone 11-16.
  - ~100 dona x ~8,000 so'm = **800,000 so'm** (Sotish: 25,000-35,000 so'm — 300% foyda!)
• **Xaridorgir Shaffof va Matoviy Chexollar:**
  - ~50 dona x ~22,000 so'm = **1,100,000 so'm** (Sotish: 45,000-60,000 so'm)
• **33W / 67W Android Super Fast Adapter komplektlari:**
  - ~12 dona x ~45,000 so'm = **540,000 so'm** (Sotish: 85,000-110,000 so'm)

---
💎 **2. Yuqori marjali qo'shimcha tovarlar (${(highMarginPart / 1_000_000).toFixed(1)} mln so'm):**
• **TWS Bluetooth Simsiz Quloqchinlar (Borofone/Hoco):**
  - ~6 dona x ~95,000 so'm = **570,000 so'm** (Sotish: 160,000-190,000 so'm)
• **10,000 - 20,000 mAh Powerbanklar (Displayli/Fast):**
  - ~4 dona x ~135,000 so'm = **540,000 so'm** (Sotish: 220,000-260,000 so'm)
• **Avtomobil Zaryadkasi va Magnitli Ushlagichlar:**
  - ~10 dona x ~39,000 so'm = **390,000 so'm** (Sotish: 75,000-90,000 so'm)

---
📊 **Kutilayotgan Natija:**
• Jami sarflangan sarmoya: **~${totalBudget.toLocaleString('uz-UZ')} so'm**
• Chakana sotuvdan kutilayotgan tushum: **~${Math.round(totalBudget * 1.85).toLocaleString('uz-UZ')} so'm**
• Kutilayotgan sof foyda: **~${Math.round(totalBudget * 0.85).toLocaleString('uz-UZ')} so'm (Marja: ~55-60%)**
• O'rtacha to'liq aylanma davri: **15 - 25 kun.**`;
  }

  // 3. What accessories to order more / Fast movers / Out of stock
  if (/ko['`ʼ]?proq|koproq|xaridorgir|qaysi.*(tovar|aksessuar)|eng ko['`ʼ]?p|zakaz.*qilish|kam qolgan/i.test(q)) {
    const outOfStockNames = rawStats.outOfStock.map((o: any) => o.name);
    const outOfStockBlock = outOfStockNames.length > 0
      ? `\n⚠️ **Sizning do'koningizda TUGAB QOLGAN (0 dona) tovarlar:**\n${outOfStockNames.slice(0, 8).map((n: string) => `• ❌ ${n}`).join('\n')}\n*Bularga birinchi navbatda buyurtma bering, aks holda har kuni kelgan xaridor quruq qo'l bilan qaytmoqda!*\n`
      : `\n✅ *Ajoyib! Hozirda omboringizda mutlaqo 0 ga tushgan tovarlar yo'q.*\n`;

    return `📈 **Do'konga Eng Ko'p Olib Kelish Kerak Bo'lgan Top Aksessuarlar:**
${outOfStockBlock}
---
🏆 **Har Doim Eng Tez Aylanadigan va Talab Yuqori 5 Toifa:**

1. **Type-C 20W va 33W Tezkor Zaryadkalar:**
   - Yangi barcha telefonlar (iPhone 12 dan 16 gacha, Samsung, Xiaomi) qutisida zaryadka boshchasi chiqmaydi. Bu do'koningizning doimiy "non-tuzi".
   - *Tavsiya:* Kamida 20-30 dona doim zaxirada tursin.

2. **Himoya Oynalari (Steklo):**
   - Marjasi eng yuqori tovar (tannarxi 7,000 - 10,000 so'm, qo'yib berish bilan sotish narxi 25,000 - 40,000 so'm).
   - *Tavsiya:* Samsung A15/A25/A35, Redmi 12/13/Note seriya, iPhone 11 dan 16 Pro Max gacha har biridan kamida 10-15 donadan.

3. **Mustahkam Zaryadka Kabellari (1m va 2m):**
   - Ayniqsa Type-C to Type-C va Type-C to Lightning to'qilgan (braided) kabellar tez sinmaydi va xaridor mamnun bo'ladi.
   - *Tavsiya:* Har xafta kamida 20-25 dona yangilang.

4. **Shaffof va Matoviy Chexollar:**
   - Yangi chiqqan modellarga telefon sotib olingan kuniyoq chexol qidiriladi.

5. **Simsiz TWS Quloqchinlar (80,000 - 150,000 so'm segmenti):**
   - Hoco, Borofone brendlarining ixcham quloqchinlari yoshlar orasida juda ommabop.`;
  }

  // 4. How to collect debts quickly and amicably
  if (/nasiya|qarz|undirish|yig['`ʼ]?ish|yig['`ʼ]?sam|xafagarchilik/i.test(q)) {
    const debtSumStr = Number(rawStats.totalDebtSum || 0).toLocaleString('uz-UZ');
    return `🤝 **Nasiyalarni Xafagarchiliksiz va Tez Yig'ishning 5 Ta Amaliy Usuli:**

Hozirda do'koningiz daftarchasida **${debtSumStr} so'm** to'lanmagan nasiya bor. Bu pul sizning yangi tovar keltirishingizga to'sqinlik qilmoqda.

---
1️⃣ **"Ta'minotchi bilan hisob-kitob" taktikasi (Eng sinalgan usul):**
Qo'ng'iroq qilib yoki Telegramdan yozganda o'zingizni aybdor his qilmang:
*"Assalomu alaykum aka/uka, yangi tovar partiyasi kelyapti, optomchilarimiz hisob-kitobni talab qilyapti. Do'kondagi aylanmani to'g'rilab olayotgandik, iloji bo'lsa hisobingizni yopib bera olasizmi?"*
*Natija:* Mijoz sizni tushunadi va o'rtada xafagarchilik bo'lmaydi.

2️⃣ **Qisman to'lov taklifi (Bo'lib to'lash):**
Agar mijoz *"Hozir hamma pulim yo'q edi"* desa, darhol yengillik bering:
*"Hech bo'lmasa 50,000 yoki 100,000 so'mini tashlab turing, qolganini keyingi haftada berarsiz."*
*Natija:* Katta summani birdan berolmayotgan mijoz qisman to'lashga oson rozi bo'ladi va qarz kamayadi.

3️⃣ **Click / Payme karta raqam va QR jo'natish:**
Ko'p mijozlar *"Do'konga borishga vaqtim bo'lmayapti"* deb cho'zadi. Telegramdan karta raqamingizni chiroyli xabar bilan jo'nating:
*"Aka, do'konga kelishingiz shart emas, mana bu kartaga tashlab qo'ysangiz ham bo'ladi: [Karta raqam]."*

4️⃣ **Ijobiy rag'bat (Bonus):**
*"Aka, hisobni shu 2 kun ichida yopib bersangiz, keyingi xaridingizga 15% chegirma yoki yangi himoya oynasi sovg'a qilamiz!"*

5️⃣ **Kelajak uchun temir qoida:**
• Nasiya berishda har doim **aniq kunni** (masalan: 18-sana) kelishib oling.
• Bir marta qarzini kechiktirgan kishiga ikkinchi marta nasiyaga tovar bermang!`;
  }

  // 5. Dead stock: How to sell frozen items fast
  if (/muzla|o['`ʼ]?lik|qotib|sotilmay|dead\s*stock|chiqarib.*yuborish|sotay/i.test(q)) {
    const deadList = rawStats.deadStock;
    const deadText = deadList && deadList.length > 0
      ? `\n📦 **Do'koningizdagi muzlab yotgan tovarlar:**\n${deadList.slice(0, 6).map((d: any) => `• ${d.name} (${d.stock} dona, ~${Number(d.tied || 0).toLocaleString('uz-UZ')} so'm pul band)`).join('\n')}\n`
      : '';

    return `⚡ **Muzlab Qolgan (O'lik) Tovarlarni Naqd Pulga Aylantirishning 4 Ta Yo'li:**
${deadText}
Savdoda eng yomon narsa — javonda oylab chang bosib yotgan tovar. Chunki pul aylanmaydi. Buni darhol hal qilish kerak:

---
1️⃣ **Kassa Oldidagi "Super Chegirma Savati" (Barchasi 10,000 so'm):**
Kassa yoniga yorqin savat yoki quti qo'ying va ustiga yozing:
*"ATIGI 10,000 SO'M / 15,000 SO'M (Ommaviy sotuv)"*.
Mijoz boshqa aksessuar sotib olayotganda, kassa oldida ko'rib, arzonligi uchun o'ylanmasdan qo'shib olib ketadi.

2️⃣ **"1+1 Sovg'a" Taktikasi (Katta xaridga bonus):**
Qimmatroq tovar olgan mijozga (masalan, 150,000 so'mdan yuqori):
*"Aka, bugun sizga maxsus aksiyamiz bor: ushbu chexol yoki kabel do'konimizdan sizga sovg'a!"* deb qo'shib bering.
*Natija:* Mijoz xursand bo'lib doimiy xaridorga aylanadi, siz esa joy bo'shatib olasiz.

3️⃣ **Tannarxida yoki 10% Zarariga Sotish:**
Hech qachon o'lik tovarga suqlanmang. Bugun 50,000 so'mlik eski chexolni 25,000 so'mga sotsangiz ham — qo'lingizga naqd 25,000 so'm tushadi. U pulga 3 dona yangi steklo olib, 1 haftada 75,000 so'm qilasiz!

4️⃣ **Boshqa ustalarga yoki bozorga optom berish:**
Telefon tuzatadigan ustalarga barcha eski qoldiqlarni kelishilgan arzon narxda birdaniga topshirib yuboring.`;
  }

  // 6. Specific product check from user message
  const words = q.split(/\s+/).filter(w => w.length >= 3);
  const matchedProduct = products.find(p => {
    const pName = p.name.toLowerCase();
    return words.some(w => pName.includes(w));
  });

  if (matchedProduct) {
    const cost = Number(matchedProduct.purchasePrice || matchedProduct.costPrice || 0);
    const sell = Number(matchedProduct.sellingPrice || 0);
    const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
    return `🔍 **"${matchedProduct.name}" Tovari Bo'yicha Ma'lumot:**

• **Mavjud zaxira:** ${matchedProduct.stock} dona
• **Toifasi:** ${matchedProduct.category}
• **Tannarxi (Kirim):** ${cost.toLocaleString('uz-UZ')} so'm
• **Chakana sotish narxi:** ${sell.toLocaleString('uz-UZ')} so'm
• **Foyda (Marja):** ${(sell - cost).toLocaleString('uz-UZ')} so'm (${margin}%)
• **Holati:** ${matchedProduct.stock <= 0 ? '❌ Qolmagan (Tugagan)' : matchedProduct.stock <= (matchedProduct.minStockAlert || 5) ? '⚠️ Kam qolgan, buyurtma bering' : '✅ Yetarli'}

💡 **Tavsiya:** ${matchedProduct.stock <= (matchedProduct.minStockAlert || 5) ? `Ushbu tovarga talab bor, kamida 10-15 dona partiya zakaz qilishni rejalashtiring.` : `Zaxira hozircha barqaror. Sotuv tezligini nazorat qilib turing.`}`;
  }

  // 7. General Store Advice & Diagnostic
  return `📊 **Paxtaobod Beeline Do'koni — AI Biznes Maslahati:**

Savolingiz: *"${userMessage}"*

**Do'koningizning hozirgi holati:**
• Jami aksessuarlar: **${products.length} xil**
• Tugagan tovarlar: **${rawStats.outOfStock.length} ta** ${rawStats.outOfStock.length > 0 ? `(${rawStats.outOfStock.slice(0, 3).map((o: any) => o.name).join(', ')})` : ''}
• Muzlab yotgan zaxira: **${rawStats.deadStock.length} ta tovar**
• Undirilmagan nasiyalar: **${Number(rawStats.totalDebtSum || 0).toLocaleString('uz-UZ')} so'm**

🎯 **Asosiy Qoidalar:**
1. **Xaridorgir tovarlar hech qachon 0 ga tushmasin:** Boshchalar (20W), kabellar va eng ommabop steklolarni zaxirada doim ushlang.
2. **70/30 qoidasiga amal qiling:** Zakaz byudjetining 70% ini tez sotiladiganlarga, faqat 30% ini yangi tovarlarga ajrating.
3. **Nasiyalarni nazorat qiling:** Nasiya berishda qat'iy muddat kelishing.

Savolingiz bo'yicha aniqroq ma'lumot olish uchun quyidagi tugmalardan birini bosishingiz mumkin:
• *"iPhone 15 va 16 chexollaridan nechtadan olish kerak?"*
• *"5 million so'mga eng xaridorgir zakaz ro'yxatini tuzib ber"*
• *"Nasiyalarni qanday qilib tez yig'sam bo'ladi?"*
• *"Muzlab qolgan o'lik tovarlarni qanday tezroq sotay?"*`;
}

/**
 * Runs deep AI analysis using Gemini 3.8 Flash model or local smart heuristic.
 */
export async function runGeminiStoreAudit(customApiKey?: string): Promise<AiAuditReport> {
  const { audit, rawStats } = computeStoreAuditData();
  const ai = getGeminiClient(customApiKey);

  if (!ai) {
    audit.usedAiModel = 'POS Smart Analytics Engine (Avtomatik Tahlil)';
    return audit;
  }

  try {
    const prompt = `
Siz Paxtaobod tumanidagi (Andijon viloyati) Beeline markazi qoshidagi telefon aksessuarlari do'konining professional Biznes Tahlilchisi va Bosh Ta'minotchisisiz (Business Analyst & Procurement Advisor).

DO'KONNING REAL STATISTIKASI:
- Do'kondagi jami tovarlar: ${rawStats.productsCount} xil
- Omborda MUTLAQO TUGAGAN (0 dona) xaridorgir tovarlar: ${JSON.stringify(rawStats.outOfStock)}
- Eng ko'p sotilayotgan tovarlar (Top Fast Movers): ${JSON.stringify(rawStats.fastMovers)}
- Oylardan beri sotilmay yotgan o'lik tovarlar (Dead Stock): ${JSON.stringify(rawStats.deadStock)}
- Qaytarilmagan nasiyalar (qarzlar): ${rawStats.totalDebtSum} so'm
- O'rtacha savdo marjasi: ${rawStats.avgMargin}%

VAZIFA:
Do'kon egasiga amaliy, jonli, o'zbek tilida professional biznes audit va xarid tavsiyalarini bering:
1. Biz savdoda aynan nimalarda xatoga yo'l qo'yyapmiz? (Mijoz boy berish, o'lik tovarlarga pul muzlatish, nasiya xatari, marja pasayishi).
2. Qaysi tovarlardan KO'PROQ buyurtma qilishimiz kerak (aniq tovar nomi, sababi va tavsiya etilgan dona soni bilan)?
3. Qaysi tovarlardan OZROQ yoki umuman BUYURTMA QILMASLIK kerak (nima uchun o'lik zaxira, uni qanday sotib tugatish kerak)?
4. Kelajakda bu xatolarni qaytarmaslik uchun do'kon egasiga 4 ta "oltin qoida".
5. Bitta jozibali, aniq xulosa (Executive Summary).

Javobni aniq o'zbek tilida, do'kondor tushunadigan amaliy tilda bering.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "Siz telefon aksessuarlari savdosi bo'yicha kuchli, aniq va amaliy tahlilchisiz. Faqat real do'kon holatiga mos amaliy maslahatlar bering. Ortiqcha gap va noaniq maslahatlardan qoching.",
        temperature: 0.7,
      }
    });

    const aiText = response.text;
    if (aiText && aiText.trim().length > 50) {
      audit.executiveSummary = aiText;
      audit.usedAiModel = 'Gemini 3.8 Flash (AI Business Analyst)';
    }
  } catch (err: any) {
    console.warn('[AiAdvisor] Gemini API unavailable or quota exceeded, using calculated audit:', err?.message || err);
    audit.usedAiModel = 'POS Smart Analytics Engine (Avtomatik Tahlil)';
  }

  return audit;
}

/**
 * Interactive Chat with AI Store Consultant.
 * Seamlessly handles Gemini API call, and gracefully falls back to local intelligent advisor
 * if API quota is depleted (429 RESOURCE_EXHAUSTED) or network error occurs.
 */
export async function askGeminiStoreAdvisor(
  userMessage: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }> = [],
  customApiKey?: string
): Promise<string> {
  const { audit, rawStats } = computeStoreAuditData();
  const state = dataStore.getState();
  const products = state.products || [];
  const movements = state.movements || [];
  const debts = state.debts || [];

  const ai = getGeminiClient(customApiKey);

  // If AI client is available, attempt to query Gemini 3.8 Flash
  if (ai) {
    try {
      const systemPrompt = `
Siz Paxtaobod Beeline telefon aksessuarlari do'konining shaxsiy sun'iy intellekt maslahatchisisiz.
Do'kon egasi sizdan tovar zakazi, savdodagi xatolar, narx belgilash, nasiyalarni yig'ish yoki foydani oshirish haqida so'raydi.

Do'konning joriy holati:
- Tugagan tovarlar: ${rawStats.outOfStock.map((o: any) => o.name).join(', ') || "Hozircha yo'q"}
- Eng xaridorgir tovarlar: ${rawStats.fastMovers.map((f: any) => f.name).join(', ') || "Mavjud"}
- O'lik zaxiralar: ${rawStats.deadStock.map((d: any) => d.name).join(', ') || "Yo'q"}
- To'lanmagan nasiyalar: ${rawStats.totalDebtSum} so'm

Qoidalar:
- O'zbek tilida xushmuomala, aniq va amaliy javob bering.
- Raqamlar va aniq tovar nomlarini keltiring.
- Qancha zakaz qilish kerakligi so'ralsa, aniq sonlar ayting.
      `;

      const contents = [
        ...chatHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents as any,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      if (response.text && response.text.trim().length > 10) {
        return response.text;
      }
    } catch (err: any) {
      console.warn('[AiAdvisor] Gemini query failed (quota/429/network). Falling back to smart local store advisor:', err?.message || err);
      // Seamlessly fall through to smart local advisor below!
    }
  }

  // Graceful, intelligent fallback to smart local store advisor
  return generateLocalStoreAdvisorAnswer(userMessage, rawStats, audit, products, movements, debts);
}
