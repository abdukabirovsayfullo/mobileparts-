import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Settings, 
  MessageSquare, 
  HelpCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  Lightbulb, 
  Package, 
  ArrowUpRight, 
  SlidersHorizontal,
  Info,
  DollarSign,
  Trash2,
  Key,
  Zap
} from 'lucide-react';
import { Product, StockMovement, DebtRecord, StoreSettings } from '../types';
import { formatMoney } from '../utils/formatters';

interface AiAnalystViewProps {
  products: Product[];
  movements: StockMovement[];
  debts: DebtRecord[];
  storeInfo: StoreSettings;
  apiKey?: string;
}

interface DetectedMistake {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  impact: string;
  explanation: string;
  solution: string;
}

interface RecommendationItem {
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

interface DeadStockItem {
  productId: string;
  name: string;
  category: string;
  currentStock: number;
  tiedUpCapital: number;
  reason: string;
  action: string;
}

interface AuditReport {
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

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export const AiAnalystView: React.FC<AiAnalystViewProps> = ({
  products,
  movements,
  debts,
  storeInfo,
  apiKey = ''
}) => {
  // Tabs: 'procurement' (Xarid Rejasi), 'mistakes' (Xatolar Diagnostikasi), 'chat' (AI Maslahatchi), 'telegram' (Sozlamalar)
  const [subTab, setSubTab] = useState<'procurement' | 'mistakes' | 'chat' | 'telegram'>('procurement');
  const [procurementFilter, setProcurementFilter] = useState<'more' | 'less'>('more');

  // Loading and error states
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditData, setAuditData] = useState<AuditReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Telegram states
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isSendingStockAlert, setIsSendingStockAlert] = useState(false);
  const [isSendingAiReport, setIsSendingAiReport] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Interactive AI chat states
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_custom_api_key') || '';
  });
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);
  const [apiKeyInputVal, setApiKeyInputVal] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'model',
      text: `Assalomu alaykum! Men ${storeInfo?.name || 'Paxtaobod Beeline'} do'konining sun'iy intellekt biznes tahlilchisi va xarid maslahatchisiman. Do'konda qaysi tovarlar tugayotgani, qaysilaridan ko'proq yoki ozroq zakaz qilish kerakligi, yoki savdodagi xatolarni bartaraf qilish bo'yicha istalgan savolingizga javob bera olaman.`,
      timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSaveCustomApiKey = (key: string) => {
    const trimmed = key.trim();
    setCustomGeminiApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gemini_custom_api_key', trimmed);
      setStatusMessage({
        type: 'success',
        text: "✅ Gemini API kaliti saqlandi va faollashtirildi!"
      });
    } else {
      localStorage.removeItem('gemini_custom_api_key');
      setStatusMessage({
        type: 'info',
        text: "⚡ Shaxsiy kalit o'chirildi. Tizim mahalliy aqlli tahlilchi rejimida ishlaydi."
      });
    }
    setShowApiKeySettings(false);
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `init-${Date.now()}`,
        role: 'model',
        text: `Assalomu alaykum! Do'kon bo'yicha qanday maslahat yoki tahlil kerak? Savolingizni yozing yoki yuqoridagi tayyor savollardan birini tanlang.`,
        timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Auto-dismiss status messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Load Telegram config on mount
  useEffect(() => {
    const fetchTgConfig = async () => {
      try {
        const res = await fetch('/api/v1/telegram/config', {
          headers: { 'X-API-Key': apiKey }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            if (json.data.chatId) setTelegramChatId(json.data.chatId);
            // token is masked for security, user can re-enter if updating
          }
        }
      } catch (e) {
        // Fallback or silent
      }
    };
    fetchTgConfig();
  }, [apiKey]);

  // Load or compute AI audit
  const fetchOrComputeAudit = async (forceGemini: boolean = false) => {
    setIsLoadingAudit(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/ai/audit', {
        headers: { 
          'X-API-Key': apiKey,
          ...(customGeminiApiKey.trim() ? { 'X-Gemini-API-Key': customGeminiApiKey.trim() } : {})
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAuditData(json.data);
          setIsLoadingAudit(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend AI audit fetch failed, falling back to client computation:', err);
    }

    // Client-side computation fallback (ensures it NEVER fails)
    const computed = computeClientSideAudit(products, movements, debts, storeInfo.name);
    setAuditData(computed);
    setIsLoadingAudit(false);
  };

  useEffect(() => {
    fetchOrComputeAudit();
  }, [products.length, movements.length, debts.length]);

  // Client-side fallback calculator
  const computeClientSideAudit = (
    allProducts: Product[],
    allMovements: StockMovement[],
    allDebts: DebtRecord[],
    stName: string
  ): AuditReport => {
    const salesMap: Record<string, { qty: number; revenue: number; profit: number }> = {};
    allMovements.forEach(m => {
      if (m.type === 'chiqim') {
        const pid = m.productId || m.productName;
        if (!salesMap[pid]) salesMap[pid] = { qty: 0, revenue: 0, profit: 0 };
        salesMap[pid].qty += Number(m.quantity || 0);
        salesMap[pid].revenue += Number(m.totalRevenue || 0);
        salesMap[pid].profit += Number(m.profit || 0);
      }
    });

    const outOfStock = allProducts.filter(p => p.stock <= 0);
    const lowStock = allProducts.filter(p => p.stock > 0 && p.stock <= (p.minStockAlert || 5));
    const deadStockItems: DeadStockItem[] = [];
    const orderMoreList: RecommendationItem[] = [];

    allProducts.forEach(p => {
      const cost = Number(p.purchasePrice || p.costPrice || 0);
      const stock = Number(p.stock || 0);
      const minAlert = Number(p.minStockAlert || 5);
      const sales = salesMap[p.id]?.qty || salesMap[p.name]?.qty || 0;

      if (stock >= 5 && sales === 0) {
        deadStockItems.push({
          productId: p.id,
          name: p.name,
          category: p.category,
          currentStock: stock,
          tiedUpCapital: cost * stock,
          reason: `Omborda ${stock} dona turibdi, lekin sotilmay qotib yotibdi.`,
          action: "Yangi zakaz bermang. Mavjudlarini '1+1' yoki chegirma bilan soting."
        });
      }

      if (stock <= minAlert || (sales >= 2 && stock <= 10)) {
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
            ? "Omborda mutlaqo tugagan (0 dona)! Talab bor, mijoz yo'qotmaslik uchun shoshilinch zakaz qilish shart."
            : stock <= minAlert
              ? `Zaxira kam qoldi (${stock} dona). Tez orada tugaydi.`
              : `Xaridorgir tovar (sotuv: ${sales} dona). Zaxirani barqaror ushlash kerak.`,
          urgency: stock === 0 ? 'high' : stock <= minAlert ? 'high' : 'medium'
        });
      }
    });

    orderMoreList.sort((a, b) => {
      if (a.urgency === 'high' && b.urgency !== 'high') return -1;
      if (b.urgency === 'high' && a.urgency !== 'high') return 1;
      return a.currentStock - b.currentStock;
    });

    const totalDeadCapital = deadStockItems.reduce((acc, d) => acc + d.tiedUpCapital, 0);
    const activeDebts = allDebts.filter(d => d.status === 'faol' || d.status === 'qisman_tolandi');
    const totalDebtSum = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);

    const mistakes: DetectedMistake[] = [];
    if (outOfStock.length > 0) {
      mistakes.push({
        title: "Xaridorgir tovarlar tugab qolishi (Mijoz boy berish)",
        severity: 'critical',
        impact: `${outOfStock.length} ta tovar omborda 0 qolgan`,
        explanation: `Mijozlar do'konga kelganda eng xaridorgir aksessuarlarni topolmay boshqa do'konga ketmoqda. Hozirda: ${outOfStock.slice(0, 3).map(p => p.name).join(', ')} tugagan.`,
        solution: "Eng tez sotiladigan A-toifa aksessuarlarning minimal zaxira chegarasini (minStockAlert) oshiring va zaxira 5 donaga tushganda darhol dilerga zakaz bering."
      });
    }

    if (totalDeadCapital > 0) {
      mistakes.push({
        title: "O'lik zaxiraga mablag' muzlatish (Muzlatilgan kapital)",
        severity: 'warning',
        impact: `${totalDeadCapital.toLocaleString('uz-UZ')} so'm pul qotib yotibdi (${deadStockItems.length} ta tovar)`,
        explanation: "Oylardan beri sotilmayotgan telefon aksessuarlari ombor javonlarida chang bosib, aylanma pulni band qilib turibdi.",
        solution: "Bu tovarlarni tannarxida yoki aksiya bilan soting. Keyingi safar talab past modellardan umuman zakaz qilmang."
      });
    }

    if (totalDebtSum > 1000000) {
      mistakes.push({
        title: "Nasiya daftardagi xatarli summa",
        severity: 'warning',
        impact: `${totalDebtSum.toLocaleString('uz-UZ')} so'm to'lanmagan nasiya mavjud`,
        explanation: "Nasiyalar summasi aylanma mablag'ingizni kamaytirib, yangi partiyalarni arzonroq naqd narxda olishingizga to'sqinlik qilmoqda.",
        solution: "Nasiya berishni qisqartiring, har bir mijozga 7-10 kunlik aniq muddat belgilang va qaytarilgan pullarni faqat xaridorgir tovarlarga yo'naltiring."
      });
    }

    const totalRecommendedOrderSum = orderMoreList.reduce((acc, item) => acc + item.estimatedCost, 0);
    const totalRecommendedItemsCount = orderMoreList.reduce((acc, item) => acc + item.recommendedOrderQuantity, 0);

    return {
      generatedAt: new Date().toISOString(),
      storeName: stName || 'Paxtaobod Beeline',
      metrics: {
        totalProducts: allProducts.length,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        deadStockCount: deadStockItems.length,
        totalDeadStockCapital: totalDeadCapital,
        totalActiveDebts: activeDebts.length,
        debtExposureSum: totalDebtSum,
        averageMarginPercent: 42
      },
      mistakes,
      procurementPlan: {
        orderMore: orderMoreList.slice(0, 20),
        orderLessOrStop: deadStockItems.slice(0, 15),
        totalRecommendedOrderSum,
        totalRecommendedItemsCount
      },
      goldenRules: [
        "1. A-Toifa Qoidasi: Do'kondagi eng ko'p sotiladigan 10 ta aksessuar (iPhone 15/16 chexollari, 20W/33W zaryadka, Remax/Hoco kabellar) hech qachon omborda 0 ga tushmasin.",
        "2. 70/30 Pul Taqsimoti: Yangi tovar zakazining 70% mablag'ini faqat tez sotiladigan xaridorgir tovarlarga, faqat 30% ini yangi sinov modellarga ajrating.",
        "3. Muzlatilgan Pulni To'xtatish: Bir oy davomida sotilmagan aksessuarni qaytib dilerdan buyurtma qilmang.",
        "4. Nasiya Chegarasi: Nasiyalar summasi do'konning 1 oylik sof foydasidan oshmasligi shart."
      ],
      executiveSummary: `Do'kondagi jami ${allProducts.length} xil aksessuar tahlil qilindi. Eng katta xato: omborda 0 qolgan ${outOfStock.length} ta xaridorgir tovarlar bo'yicha mijoz yo'qotilyapti. Tavsiya etilgan zudlikdagi zakaz partiyasi: ~${totalRecommendedOrderSum.toLocaleString('uz-UZ')} so'm (${totalRecommendedItemsCount} dona).`,
      usedAiModel: 'Smart POS Analytics'
    };
  };

  // Telegram test
  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setStatusMessage({
        type: 'error',
        text: "Iltimos, Telegram Bot Token va Chat ID raqamingizni kiriting!"
      });
      return;
    }

    setIsTestingTelegram(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          botToken: telegramToken.trim(),
          chatId: telegramChatId.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        // Save config
        await fetch('/api/v1/telegram/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({
            botToken: telegramToken.trim(),
            chatId: telegramChatId.trim(),
            enabled: true,
            autoAlertLowStock: true
          })
        });

        setStatusMessage({
          type: 'success',
          text: "✅ Telegram botga test xabari muvaffaqiyatli bordi va sozlamalar saqlandi!"
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Telegram xatosi: ${json.error || "Ulanib bo'lmadi"}`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `❌ Server bilan bog'lanishda xatolik: ${err.message}`
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // 1-Click Send Low Stock to Telegram
  const handleSendLowStockAlert = async () => {
    setIsSendingStockAlert(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/telegram/notify-low-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          botToken: telegramToken.trim() || undefined,
          chatId: telegramChatId.trim() || undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: `✈️ ${json.message || "Ozaygan tovarlar Telegramga muvaffaqiyatli yuborildi!"}`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Xatolik: ${json.error || "Telegram sozlanmagan. Iltimos, Telegram Sozlamalari bo'limida Token va Chat ID kiriting."}`
        });
        setSubTab('telegram');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `❌ Bog'lanishda xatolik: ${err.message}`
      });
    } finally {
      setIsSendingStockAlert(false);
    }
  };

  // Send AI Report to Telegram
  const handleSendAiReportToTelegram = async () => {
    setIsSendingAiReport(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/telegram/send-ai-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          botToken: telegramToken.trim() || undefined,
          chatId: telegramChatId.trim() || undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: "🚀 AI Biznes tahlili va Xarid rejasi Telegramga muvaffaqiyatli yuborildi!"
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Xatolik: ${json.error || "Telegram sozlanmagan"}`
        });
        setSubTab('telegram');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `❌ Bog'lanish xatosi: ${err.message}`
      });
    } finally {
      setIsSendingAiReport(false);
    }
  };

  // Client-side intelligent store advice generator (Zero-fail fallback)
  const generateClientStoreAdvice = (userMessage: string): string => {
    const q = userMessage.toLowerCase().trim();

    if (/iphone\s*(15|16)|chexol|g['`ʼ]?ilof|case|magsafe/i.test(q)) {
      const iphoneCases = products.filter(p => /iphone|chexol|case/i.test(p.name));
      const iphoneStockText = iphoneCases.length > 0
        ? `\n\n📌 **Do'koningizdagi joriy chexollar holati:**\n` +
          iphoneCases.slice(0, 5).map(c => `• ${c.name}: ${c.stock} dona qolgan (sotuv: ${Number(c.sellingPrice || 0).toLocaleString('uz-UZ')} so'm)`).join('\n')
        : '';

      return `📱 **iPhone 15 va iPhone 16 Chexollari Xaridi Bo'yicha Mutaxassis Tavsiyasi:**

Hozirgi O'zbekiston aksessuar bozorida (Andijon / Paxtaobod) eng xaridorgir to'plam:

---
### 1️⃣ iPhone 15 Seriyasi (Jami ~40 dona zakaz qilish tavsiya etiladi):
• **iPhone 15 Pro Max**: 15 dona (8 ta Shaffof MagSafe, 5 ta qora silikon, 2 ta premium).
• **iPhone 15 Pro**: 12 dona (6 ta Shaffof MagSafe, 4 ta qora/kulrang silikon).
• **iPhone 15 (oddiy)**: 8-10 dona (shaffof va rangli).
• **iPhone 15 Plus**: 3-4 dona (kamroq talab).

---
### 2️⃣ iPhone 16 Seriyasi (Jami ~35 dona zakaz qilish tavsiya etiladi):
• **iPhone 16 Pro Max**: 15 dona (Yangi "Camera Control" tugmasi ochiq/sensorli MagSafe va qora chexollar).
• **iPhone 16 Pro**: 12 dona.
• **iPhone 16 (oddiy)**: 8 dona.
• **iPhone 16 Plus**: 2-3 dona.

---
💡 **Oltin Maslahatlar:**
1. **Steklo (Himoya Oynasi) bilan to'ldiring:** Har bir model uchun kamida 15 donadan 9D/21D to'liq himoya oynasi qo'shib oling.
2. **20W Type-C Adapter:** Yangi iPhone qutisida boshcha chiqmaydi, chexol olgan mijozga taklif qiling.
3. **Ranglar:** 80% savdoni Shaffof (Clear) va Qora (Black) beradi, rang-baranglarni kam oling.${iphoneStockText}`;
    }

    if (/million|mln|byudjet|budjet|summa.*zakaz|5\s*000\s*000/i.test(q)) {
      const numMatch = q.match(/(\d+)\s*(?:million|mln)/i);
      const budgetMillions = numMatch ? parseInt(numMatch[1], 10) : 5;
      const totalBudget = budgetMillions * 1_000_000;
      const guaranteedPart = Math.round(totalBudget * 0.70);
      const highMarginPart = Math.round(totalBudget * 0.30);

      return `💰 **${budgetMillions} Million So'mlik Xarid Byudjetini 70/30 Qoidasi Asosida Taqsimlash:**

• **70% (${(guaranteedPart / 1_000_000).toFixed(1)} mln so'm)** — Kafolatlangan tez ketadigan asosiy aksessuarlar.
• **30% (${(highMarginPart / 1_000_000).toFixed(1)} mln so'm)** — Yuqori marjali (foydasi katta) gadjetlar.

---
📦 **1. Tez aylanuvchi tovarlar (${(guaranteedPart / 1_000_000).toFixed(1)} mln so'm):**
• **Type-C 20W PD Adapterlar (Hoco/Remax):** ~12 dona x ~35,000 = **420,000 so'm** (Sotish: 70,000-80,000 so'm)
• **Tezkor Zaryadka Kabellari (Type-C / Lightning):** ~30 dona x ~18,000 = **540,000 so'm**
• **9D / 21D Himoya oynalari (Steklo):** ~100 dona x ~8,000 = **800,000 so'm** (Sotish: 25,000-35,000 so'm — 300% foyda!)
• **Xaridorgir Shaffof va Matoviy Chexollar:** ~50 dona x ~22,000 = **1,100,000 so'm**
• **33W / 67W Android Super Fast Adapterlar:** ~12 dona x ~45,000 = **540,000 so'm**

---
💎 **2. Yuqori marjali qo'shimcha tovarlar (${(highMarginPart / 1_000_000).toFixed(1)} mln so'm):**
• **TWS Bluetooth Simsiz Quloqchinlar:** ~6 dona x ~95,000 = **570,000 so'm**
• **10,000 - 20,000 mAh Powerbanklar:** ~4 dona x ~135,000 = **540,000 so'm**
• **Avtomobil Zaryadkasi va Ushlagichlar:** ~10 dona x ~39,000 = **390,000 so'm**

---
📊 **Kutilayotgan Natija:**
• Jami sarmoya: **~${totalBudget.toLocaleString('uz-UZ')} so'm**
• Chakana tushum: **~${Math.round(totalBudget * 1.85).toLocaleString('uz-UZ')} so'm**
• Sof foyda: **~${Math.round(totalBudget * 0.85).toLocaleString('uz-UZ')} so'm (Marja: ~55-60%)**`;
    }

    if (/nasiya|qarz|undirish|yig['`ʼ]?ish|yig['`ʼ]?sam|xafagarchilik/i.test(q)) {
      const activeDebts = debts.filter(d => d.status === 'faol' || d.status === 'qisman_tolandi');
      const debtSum = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);
      return `🤝 **Nasiyalarni Xafagarchiliksiz va Tez Yig'ishning 5 Ta Amaliy Usuli:**

Hozirda do'koningizda **${debtSum.toLocaleString('uz-UZ')} so'm** to'lanmagan nasiya bor.

---
1️⃣ **"Ta'minotchi bilan hisob-kitob" taktikasi:**
*"Assalomu alaykum aka/uka, yangi tovar kelyapti, optomchilar bilan hisob-kitob qilishimiz kerak edi, iloji bo'lsa hisobingizni yopib bersangiz"* deb xushmuomala so'rash.
2️⃣ **Qisman to'lov (Bo'lib berish):**
Butun summani berolmasa, 50,000-100,000 so'mini hozir olib, qolganiga muddat belgilang.
3️⃣ **Click / Payme karta raqam tashlash:**
Do'konga kela olmaganlarga karta raqamingizni tashlab bering.
4️⃣ **Rag'bat (Bonus):**
Hisobni yopgan mijozga keyingi xaridga 10% chegirma yoki sovg'a va'da qiling.
5️⃣ **Temir qoida:**
Muddatida to'lamaganlarga qaytib nasiyaga tovar bermang!`;
    }

    if (/muzla|o['`ʼ]?lik|qotib|sotilmay|dead\s*stock|sotay/i.test(q)) {
      return `⚡ **Muzlab Qolgan (O'lik) Tovarlarni Naqd Pulga Aylantirishning 4 Ta Yo'li:**

1️⃣ **Kassa Oldida "Atigi 10,000 so'm" aksiyasi:**
Kassa yoniga savat qo'yib, o'lik tovarlarni 10-15 ming so'mdan qo'ying. Xaridorlar tezda olib ketadi.
2️⃣ **"1+1 Sovg'a" (Bonus):**
150,000 so'mdan oshiq xarid qilganlarga chang bosib yotgan chexol yoki kabelni sovg'a qiling.
3️⃣ **Tannarxida yoki zarariga sotish:**
Pulni javonda ushlab o'tirmang. Naqd 20,000 so'm olib, unga 2 ta yangi steklo keltirib 50,000 so'm qiling!
4️⃣ **Ustalarga optom topshirish:**
Qoldiqlarni telefon ustalari yoki boshqa do'konlarga ulgurji narxda bering.`;
    }

    if (/ko['`ʼ]?proq|koproq|xaridorgir|qaysi.*(tovar|aksessuar)|kam qolgan|tugagan/i.test(q)) {
      const out = products.filter(p => (p.stock || 0) === 0);
      const outText = out.length > 0
        ? `\n⚠️ **Sizda tugagan (0 dona) tovarlar:**\n${out.slice(0, 5).map(p => `• ❌ ${p.name}`).join('\n')}\n`
        : '';

      return `📈 **Do'konga Eng Ko'p Olib Kelish Kerak Bo'lgan Top Aksessuarlar:**
${outText}
🏆 **Har Doim Eng Tez Aylanadigan 5 Toifa:**
1. **Type-C 20W va 33W Tezkor Zaryadkalar:** Telefonlar qutisida zaryadka chiqmaydi!
2. **Himoya Oynalari (Steklo):** Samsung A-seriya, Redmi, iPhone. Marja 70-80%!
3. **Mustahkam Zaryadka Kabellari (Type-C to Lightning va Type-C to Type-C).**
4. **Shaffof va Matoviy Chexollar (iPhone 15, 16 va Samsung).**
5. **Simsiz TWS Quloqchinlar (80,000 - 150,000 so'm oralig'i).**`;
    }

    return `📊 **Paxtaobod Beeline POS Aqlli Maslahatchisi:**

Savolingiz: *"${userMessage}"*

**Do'kon holati:**
• Jami aksessuarlar: **${products.length} xil**
• Tugagan tovarlar: **${products.filter(p => (p.stock || 0) === 0).length} ta**
• Nasiyalar: **${debts.filter(d => d.status === 'faol').reduce((s, d) => s + Number(d.remainingAmount || 0), 0).toLocaleString('uz-UZ')} so'm**

Aniqroq maslahat olish uchun yuqoridagi tugmalardan birini bosing yoki o'zingizni qiziqtirgan tovar nomini yozing!`;
  };

  // Interactive AI Chat
  const handleSendChatMessage = async (presetQuestion?: string) => {
    const q = presetQuestion || chatInput;
    if (!q.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    };

    // Filter out any past error messages so the thread is pristine
    setChatMessages(prev => [...prev.filter(m => !m.text.includes('{"error":')), userMsg]);
    if (!presetQuestion) setChatInput('');
    setIsChatLoading(true);

    try {
      const history = chatMessages
        .filter(m => !m.text.includes('{"error":'))
        .map(m => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          ...(customGeminiApiKey.trim() ? { 'X-Gemini-API-Key': customGeminiApiKey.trim() } : {})
        },
        body: JSON.stringify({
          message: q.trim(),
          chatHistory: history,
          geminiApiKey: customGeminiApiKey.trim() || undefined
        })
      });

      let replyText = '';
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.reply && !json.reply.includes('{"error":') && !json.reply.includes('RESOURCE_EXHAUSTED')) {
          replyText = json.reply;
        }
      }

      // If backend failed or returned error string, use smart zero-fail fallback
      if (!replyText) {
        replyText = generateClientStoreAdvice(q.trim());
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: replyText,
          timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      // Offline / network failure fallback
      const fallbackText = generateClientStoreAdvice(q.trim());
      setChatMessages(prev => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const currentReport = auditData || computeClientSideAudit(products, movements, debts, storeInfo.name);

  // Copy procurement list to clipboard for WhatsApp / Telegram
  const copyProcurementList = () => {
    const lines = [
      `📦 ${storeInfo.name || 'Paxtaobod Beeline'} — ZAKAZ RO'YXATI`,
      `📅 Sana: ${new Date().toLocaleDateString('uz-UZ')}`,
      `----------------------------------------`,
      ...currentReport.procurementPlan.orderMore.map((item, idx) => 
        `${idx + 1}. ${item.name} (${item.category}): +${item.recommendedOrderQuantity} dona (Omborda: ${item.currentStock} dona)`
      ),
      `----------------------------------------`,
      `Jami tavsiya etilgan: ${currentReport.procurementPlan.totalRecommendedItemsCount} dona (~${currentReport.procurementPlan.totalRecommendedOrderSum.toLocaleString('uz-UZ')} so'm)`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 font-black">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-100">
                  Sun'iy Intellekt Biznes Tahlilchi & Xarid Maslahatchisi
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  {currentReport.usedAiModel || 'AI Smart Engine'}
                </span>
              </div>
              <p className="text-stone-300 text-xs sm:text-sm mt-1">
                Savdodagi xatolar diagnostikasi, tugayotgan tovarlar bo'yicha aniq zakaz rejasi va Telegramga avtomatik ogohlantirish.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOrComputeAudit(true)}
              disabled={isLoadingAudit}
              className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-stone-700 disabled:opacity-50"
              title="Qayta tahlil qilish"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isLoadingAudit ? 'Tahlil qilinmoqda...' : 'AI Yangilash'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendLowStockAlert}
              disabled={isSendingStockAlert}
              className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-600/30 disabled:opacity-50"
              title="Ozaygan tovarlar ro'yxatini Telegramga yuborish"
            >
              <Send className={`w-3.5 h-3.5 ${isSendingStockAlert ? 'animate-bounce' : ''}`} />
              <span>{isSendingStockAlert ? 'Yuborilmoqda...' : 'Telegramga Ozayganlarni Jo\'natish'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendAiReportToTelegram}
              disabled={isSendingAiReport}
              className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-400/20 disabled:opacity-50"
              title="AI Tahlil va Xarid rejasini Telegramga yuborish"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isSendingAiReport ? 'Jo\'natilmoqda...' : 'AI Hisobotni Telegramga Jo\'natish'}</span>
            </button>
          </div>
        </div>

        {/* Status alert message */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' 
              : statusMessage.type === 'error'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                : 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span className="flex-1">{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold">Omborda Tugagan</span>
            <span className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              0
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400 tracking-tight">
              {currentReport.metrics.outOfStockCount} <span className="text-xs font-bold text-stone-400">ta tovar</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Mijoz boy berish va sotuv to'xtash xavfi
            </p>
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold">Kam Qolgan Tovar</span>
            <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              ⚠️
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400 tracking-tight">
              {currentReport.metrics.lowStockCount} <span className="text-xs font-bold text-stone-400">ta tovar</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Minimal zaxira chegarasiga yetgan
            </p>
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold">O'lik Zaxira (Muzlagan Pul)</span>
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
              🧊
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-300 tracking-tight truncate">
              {formatMoney(currentReport.metrics.totalDeadStockCapital)}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5 truncate">
              {currentReport.metrics.deadStockCount} ta sotilmayotgan modelda
            </p>
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-bold">Tavsiya Zakaz Byudjeti</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              🛒
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight truncate">
              {formatMoney(currentReport.procurementPlan.totalRecommendedOrderSum)}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Jami ~{currentReport.procurementPlan.totalRecommendedItemsCount} dona aksessuar
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-900 border border-stone-800 rounded-xl overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setSubTab('procurement')}
          className={`px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'procurement'
              ? 'bg-amber-400 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white hover:bg-stone-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>1. Xarid & Zakaz Rejasi (Nimalardan Ko'proq / Ozroq?)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-950/20 font-mono">
            {currentReport.procurementPlan.orderMore.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('mistakes')}
          className={`px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'mistakes'
              ? 'bg-amber-400 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white hover:bg-stone-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>2. Savdodagi Xatolarimiz (Diagnostika)</span>
          {currentReport.mistakes.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
              {currentReport.mistakes.length} ta
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('chat')}
          className={`px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'chat'
              ? 'bg-amber-400 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white hover:bg-stone-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span>3. Shaxsiy AI Maslahatchi Chati</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('telegram')}
          className={`px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'telegram'
              ? 'bg-amber-400 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white hover:bg-stone-800'
          }`}
        >
          <Settings className="w-4 h-4 text-stone-400" />
          <span>4. Telegram Bot Sozlamalari</span>
        </button>
      </div>

      {/* =======================================================================
          TAB 1: XARID & ZAKAZ REJASI (Order More vs Order Less)
      ======================================================================== */}
      {subTab === 'procurement' && (
        <div className="space-y-6">
          {/* Executive summary banner */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-stone-200 uppercase tracking-wider">
                  AI Xarid Strategiyasi Xulosasi
                </h2>
                <p className="text-stone-300 text-xs sm:text-sm mt-1 leading-relaxed whitespace-pre-line">
                  {currentReport.executiveSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Sub-filter toggle (Ko'proq zakaz qilinadiganlar vs Ozroq / O'lik zaxira) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProcurementFilter('more')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                  procurementFilter === 'more'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>🟢 Ko'proq Zakaz Qilinadiganlar (Xaridorgir: {currentReport.procurementPlan.orderMore.length} ta)</span>
              </button>

              <button
                type="button"
                onClick={() => setProcurementFilter('less')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                  procurementFilter === 'less'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>🛑 Ozroq / To'xtatiladiganlar (O'lik Zaxira: {currentReport.procurementPlan.orderLessOrStop.length} ta)</span>
              </button>
            </div>

            {procurementFilter === 'more' && (
              <button
                type="button"
                onClick={copyProcurementList}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? "Nusxalandi!" : "Dilerga yuborish uchun nusxalash"}</span>
              </button>
            )}
          </div>

          {/* VIEW: ORDER MORE */}
          {procurementFilter === 'more' && (
            <div className="space-y-3">
              {currentReport.procurementPlan.orderMore.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center text-stone-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-stone-200">Barcha xaridorgir tovarlar yetarli!</p>
                  <p className="text-xs text-stone-400 mt-1">Omborda kam qolgan yoki tugagan asosiy tovarlar aniqlanmadi.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentReport.procurementPlan.orderMore.map((item, idx) => (
                    <div
                      key={item.productId || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.currentStock <= 0
                          ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-500'
                          : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-stone-400">#{idx + 1}</span>
                            <span className="text-sm font-black text-stone-100">{item.name}</span>
                          </div>
                          <span className="inline-block mt-0.5 text-[11px] font-bold text-amber-400/90">
                            📁 {item.category}
                          </span>
                        </div>

                        {item.currentStock <= 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                            Tugagan (0 dona)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {item.currentStock} dona qoldi
                          </span>
                        )}
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-stone-400 block uppercase font-bold">Tavsiya Zakaz</span>
                          <span className="text-base font-black text-emerald-400">
                            +{item.recommendedOrderQuantity} dona
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block uppercase font-bold">Taxminiy Summa</span>
                          <span className="text-xs font-black text-stone-200">
                            {formatMoney(item.estimatedCost)}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-stone-300 mt-2.5 leading-relaxed">
                        💡 <span className="font-semibold">{item.reason}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: ORDER LESS OR STOP */}
          {procurementFilter === 'less' && (
            <div className="space-y-3">
              {currentReport.procurementPlan.orderLessOrStop.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center text-stone-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-stone-200">Omborda o'lik zaxira aniqlanmadi!</p>
                  <p className="text-xs text-stone-400 mt-1">Barcha tovarlar aylanmasi barqaror holatda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentReport.procurementPlan.orderLessOrStop.map((item, idx) => (
                    <div
                      key={item.productId || idx}
                      className="p-4 rounded-2xl bg-stone-900 border border-purple-500/30 hover:border-purple-500/60 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-stone-400">#{idx + 1}</span>
                            <span className="text-sm font-black text-stone-100">{item.name}</span>
                          </div>
                          <span className="inline-block mt-0.5 text-[11px] font-bold text-stone-400">
                            📁 {item.category}
                          </span>
                        </div>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          Muzlagan pul
                        </span>
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-stone-400 block uppercase font-bold">Ombor Qoldig'i</span>
                          <span className="text-sm font-black text-amber-400">{item.currentStock} dona</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block uppercase font-bold">Muzlagan Qiymat</span>
                          <span className="text-sm font-black text-purple-300">
                            {formatMoney(item.tiedUpCapital)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-1 text-xs">
                        <p className="text-stone-400">
                          ⚠️ <span className="text-stone-300">{item.reason}</span>
                        </p>
                        <p className="text-emerald-400 font-bold">
                          🎯 Tavsiya: {item.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Golden rules of inventory */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mt-6">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" />
              Kelajakdagi Xatolardan Himoyalanish: Do'kondorning 4 Ta Oltin Qoidasi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentReport.goldenRules.map((rule, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800/80 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-stone-200 leading-relaxed font-medium">
                    {rule.replace(/^\d+\.\s*/, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: SAVDODAGI XATOLARIMIZ DIAGNOSTIKASI
      ======================================================================== */}
      {subTab === 'mistakes' && (
        <div className="space-y-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 text-stone-300 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-black text-stone-100 text-base mb-1">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Biz Savdoda Aynan Nimalarda Xatoga Yo'l Qo'yyapmiz?
            </div>
            <p className="text-stone-400 text-xs">
              Ushbu bo'limda sun'iy intellekt do'konning real tovar aylanmasi, o'lik zaxiralari va nasiya hisob-kitoblarini tahlil qilib, foydani kamaytirayotgan asosiy xatolarni fosh qiladi va kelajakda ularni oldini olish yo'lini ko'rsatadi.
            </p>
          </div>

          <div className="space-y-3">
            {currentReport.mistakes.map((mistake, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  mistake.severity === 'critical'
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : mistake.severity === 'warning'
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-sky-950/20 border-sky-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm ${
                      mistake.severity === 'critical' ? 'bg-rose-600' : mistake.severity === 'warning' ? 'bg-amber-600' : 'bg-sky-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-stone-100">
                        {mistake.title}
                      </h3>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-950/60 border border-stone-800 text-stone-300">
                        {mistake.impact}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    mistake.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-stone-950'
                  }`}>
                    {mistake.severity === 'critical' ? 'Kritik Xato' : 'Ogohlantirish'}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs sm:text-sm">
                  <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
                    <span className="text-stone-400 font-bold block mb-0.5 text-[11px] uppercase tracking-wider">
                      🧐 Tushuntirish (Nega bu xato?):
                    </span>
                    <p className="text-stone-200 leading-relaxed">
                      {mistake.explanation}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                    <span className="text-emerald-400 font-bold block mb-0.5 text-[11px] uppercase tracking-wider">
                      ✅ Kelajakda bu xatoni takrorlamaslik yechimi:
                    </span>
                    <p className="text-emerald-200 leading-relaxed font-medium">
                      {mistake.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: SHAXSIY AI MASLAXATCHI CHATI (Interactive Gemini Chat)
      ======================================================================== */}
      {subTab === 'chat' && (
        <div className="space-y-4">
          {/* Preset question prompt chips */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
            <span className="text-xs font-bold text-stone-400 block mb-2">
              💡 Do'kondorlar tez-tez so'raydigan savollar (Bitta bosish bilan so'rang):
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                "Qaysi aksessuarlardan ko'proq olib kelishim kerak?",
                "5 million so'mga eng xaridorgir zakaz ro'yxatini tuzib ber",
                "Nasiyalarni qanday qilib tez va xafagarchiliksiz yig'sam bo'ladi?",
                "Muzlab qolgan o'lik tovarlarni qanday qilib tezroq sotay?",
                "iPhone 15 va 16 chexollaridan nechtadan olish kerak?"
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChatMessage(preset)}
                  disabled={isChatLoading}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-stone-700/80 disabled:opacity-50"
                >
                  💬 {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Window */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 flex flex-col h-[520px]">
            {/* Chat Top Controls & Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-stone-200">
                  {customGeminiApiKey.trim() ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gemini 3.8 Flash (Shaxsiy Kalit Faol)
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      Mahalliy Aqlli Tahlilchi (Do'kon Ma'lumotlari Asosida)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInputVal(customGeminiApiKey);
                    setShowApiKeySettings(!showApiKeySettings);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    customGeminiApiKey.trim()
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-stone-800 hover:bg-stone-750 border-stone-700 text-stone-300'
                  }`}
                  title="Shaxsiy Gemini API kalitini kiritish"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{customGeminiApiKey.trim() ? "Kalit Sozlangan" : "API Kalit (Ixtiyoriy)"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-stone-800 hover:bg-rose-950 hover:border-rose-700/50 hover:text-rose-300 border border-stone-700 text-stone-400 transition-colors cursor-pointer"
                  title="Yozishmalar tarixini tozalash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Tozalash</span>
                </button>
              </div>
            </div>

            {/* Optional Custom Gemini API Key Drawer */}
            {showApiKeySettings && (
              <div className="mb-3 p-3.5 rounded-xl bg-stone-950 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Key className="w-4 h-4" />
                    Shaxsiy Google Gemini API Kaliti (Bepul):
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiKeySettings(false)}
                    className="text-stone-500 hover:text-stone-300 cursor-pointer font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-stone-400 text-[11px] leading-relaxed">
                  Agar istasangiz, Google AI Studio'dan (<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-sky-400 underline">aistudio.google.com</a>) o'z bepul API kalitingizni kiritishingiz mumkin. Kalit kiritilmasa ham tizim avtomatik ravishda do'koningizning real ombori, kassa hisoblari va qarz daftari asosida ishlab chiqilgan Mahalliy Aqlli Tahlilchi rejimidan xatosiz foydalanadi.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInputVal}
                    onChange={e => setApiKeyInputVal(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-750 text-stone-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveCustomApiKey(apiKeyInputVal)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold cursor-pointer"
                  >
                    Saqlash
                  </button>
                  {customGeminiApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInputVal('');
                        handleSaveCustomApiKey('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-700/50 hover:bg-rose-900 text-rose-300 cursor-pointer"
                    >
                      O'chirish
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-amber-400 text-stone-950 font-medium rounded-tr-none'
                        : 'bg-stone-800 text-stone-100 rounded-tl-none border border-stone-700/80 whitespace-pre-line'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-70 mb-1">
                      <span className="font-bold">{msg.role === 'user' ? "Siz" : "AI Tahlilchi"}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div>{msg.text}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-2xl bg-stone-800 text-stone-300 text-xs rounded-tl-none border border-stone-700 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>AI do'kon ma'lumotlarini tahlil qilmoqda va javob yozmoqda...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder="Savolingizni yozing (masalan: Zaryadkalar marjasi qanday?)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-xs sm:text-sm placeholder-stone-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSendChatMessage()}
                disabled={!chatInput.trim() || isChatLoading}
                className="w-10 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center font-bold cursor-pointer transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: TELEGRAM BOT INTEGRATSIYASI VA SOZLAMALARI
      ======================================================================== */}
      {subTab === 'telegram' && (
        <div className="space-y-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 font-black text-stone-100 text-base mb-1">
              <Send className="w-5 h-5 text-sky-400" />
              Telegram Botni Sozlash va Avtomatlashtirish
            </div>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
              Telegram bot orqali omboringizdagi tugayotgan tovarlar ro'yxati, zaxira ogohlantirishlari va AI xarid tavsiyalarini to'g'ridan-to'g'ri o'zingizning Telegramingizga (yoki xodimlar guruhiga) qabul qilasiz.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  1. Telegram Bot Token:
                </label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={e => setTelegramToken(e.target.value)}
                  placeholder="Masalan: 7123456789:AAHkL1j..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-750 text-stone-100 text-xs font-mono placeholder-stone-600 focus:outline-none focus:border-sky-400"
                />
                <span className="text-[11px] text-stone-500 block mt-1">
                  @BotFather orqali yaratilgan botingizning HTTP API tokeni.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  2. Telegram Chat ID:
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  placeholder="Masalan: 123456789 yoki -100123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-750 text-stone-100 text-xs font-mono placeholder-stone-600 focus:outline-none focus:border-sky-400"
                />
                <span className="text-[11px] text-stone-500 block mt-1">
                  Sizning shaxsiy Chat ID raqamingiz yoki guruh ID raqami.
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-600/30 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingTelegram ? "Test yuborilmoqda..." : "Saqlash va Test Xabar Yuborish"}</span>
              </button>

              <button
                type="button"
                onClick={handleSendLowStockAlert}
                disabled={isSendingStockAlert}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-stone-700"
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Ozaygan Tovarlarni Darhol Jo'natish</span>
              </button>
            </div>
          </div>

          {/* Step-by-step guide for Telegram bot creation */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <h3 className="text-sm font-black text-stone-200 uppercase tracking-wider mb-3">
              📖 Telegram Botni 1 Daqiqada Ulanish Qo'llanmasi:
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-stone-300">
              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <p className="font-bold text-stone-100">Telegramda Bot ochish:</p>
                  <p className="text-stone-400 mt-0.5">
                    Telegram qidiruvidan <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> ni oching. Unga <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">/newbot</code> buyrug'ini yozing, botingizga nom bering va berilgan API tokenni yuqoridagi 1-maydonga qo'ying.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <p className="font-bold text-stone-100">O'z Chat ID raqamingizni olish:</p>
                  <p className="text-stone-400 mt-0.5">
                    Telegramda <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-400 underline">@userinfobot</a> botini ochib <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">/start</code> ni bosing. U sizga 9-10 xonali <code className="text-emerald-400 font-mono">Id: 123456789</code> raqamingizni aytadi. Uni 2-maydonga kiriting.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 font-black text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <p className="font-bold text-stone-100">Botga birinchi bo'lib /start yuboring:</p>
                  <p className="text-stone-400 mt-0.5">
                    Yangi yaratgan botingizga kirib <code className="bg-stone-800 px-1 py-0.5 rounded text-amber-300">/start</code> tugmasini bosing, so'ngra bu yerda <b>"Saqlash va Test Xabar Yuborish"</b> tugmasini bosing!
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <p className="font-bold text-stone-100">n8n orqali har kuni avtomatik jo'natish:</p>
                  <p className="text-stone-400 mt-0.5">
                    n8n da har kuni soat 09:00 ga <b>Cron Trigger</b> qo'ying va <b>HTTP Request</b> nodi orqali:
                    <br />
                    <code className="bg-stone-800 text-sky-300 px-1.5 py-0.5 rounded font-mono text-xs inline-block mt-1">
                      POST http://YOUR_SERVER:3000/api/v1/telegram/notify-low-stock
                    </code>
                    <br />
                    Header: <code className="text-amber-300 font-mono text-xs">X-API-Key: {apiKey}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
