import React, { useState } from 'react';
import { 
  X, 
  Code2, 
  KeyRound, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  Bot, 
  Database, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  Zap,
  Globe
} from 'lucide-react';

interface ApiIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  onSyncNow?: () => Promise<void>;
  isSyncing?: boolean;
}

export const ApiIntegrationModal: React.FC<ApiIntegrationModalProps> = ({
  isOpen,
  onClose,
  apiKey = 'pb_pos_sec_77a94d8b',
  onSyncNow,
  isSyncing = false
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<'n8n' | 'curl' | 'python' | 'javascript' | '1c'>('n8n');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string>('');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>('/api/v1/products');

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3000/api/v1';

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleRunLiveTest = async () => {
    setTestStatus('loading');
    setTestResult('');
    try {
      const res = await fetch(`${baseUrl}/products?limit=2`, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestResult(JSON.stringify(data, null, 2));
      } else {
        setTestStatus('error');
        setTestResult(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestResult(JSON.stringify({ error: err?.message || 'Ulanishda xatolik yuz berdi' }, null, 2));
    }
  };

  const endpoints = [
    {
      id: 'get-products',
      method: 'GET',
      path: '/products',
      title: 'Barcha tovarlar va qoldiqlar',
      desc: 'Ombordagi aksessuarlar, ularning zaxirasi (stock), tan narxi, chakana va optom narxlari.',
      params: '?search=remax&category=Kabellar&low_stock=true&limit=50',
      sampleCurl: `curl -H "X-API-Key: ${apiKey}" "${baseUrl}/products?limit=10"`
    },
    {
      id: 'get-single-product',
      method: 'GET',
      path: '/products/:idOrBarcode',
      title: 'Shtrix-kod yoki ID orqali qidirish',
      desc: 'Shtrix-kod skan qilinganda yoki bitta tovar kartochkasini olishda foydalaniladi.',
      sampleCurl: `curl -H "X-API-Key: ${apiKey}" "${baseUrl}/products/478001"`
    },
    {
      id: 'post-sales',
      method: 'POST',
      path: '/sales',
      title: 'Tashqi savdo qayd etish (Chiqim)',
      desc: '1C, Telegram-bot yoki veb-sayt orqali tovar sotilganda avtomatik ombor qoldig\'ini kamaytiradi, sof foydani hisoblaydi.',
      body: JSON.stringify({
        customerName: 'Telegram Bot Xaridor',
        customerPhone: '+998901234567',
        paymentMethod: 'click_payme',
        items: [
          { productId: 'prod-1', quantity: 1, unitPrice: 85000 }
        ]
      }, null, 2),
      sampleCurl: `curl -X POST -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{"customerName":"Bot Xaridor","paymentMethod":"naqd","items":[{"productId":"prod-1","quantity":1}]}' "${baseUrl}/sales"`
    },
    {
      id: 'post-products',
      method: 'POST',
      path: '/products',
      title: 'Yangi tovar qo\'shish / 1C sinxronizatsiyasi',
      desc: '1C yoki tashqi bazadan tovarlarni yuklash (bitta tovar yoki bir vaqtda 100 tagacha tovarlar massivi).',
      body: JSON.stringify({
        name: 'Hoco C12 2.4A Quvvatlagich',
        category: 'Zaryadniklar',
        brand: 'Hoco',
        purchasePrice: 32000,
        sellingPrice: 55000,
        wholesalePrice: 42000,
        stock: 25,
        minStockAlert: 5
      }, null, 2),
      sampleCurl: `curl -X POST -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{"name":"Yangi Tovar","category":"Kabellar","purchasePrice":20000,"sellingPrice":35000,"stock":10}' "${baseUrl}/products"`
    },
    {
      id: 'post-kirim',
      method: 'POST',
      path: '/kirim',
      title: 'Ta\'minotchidan prikhod qilish (Kirim)',
      desc: 'Yangi partiya tovarlar kelganda omborni to\'ldirish va narxlarni yangilash.',
      sampleCurl: `curl -X POST -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{"supplier":"Abu Saxiy Baza","items":[{"productId":"prod-1","quantity":10,"unitCost":45000}]}' "${baseUrl}/kirim"`
    },
    {
      id: 'get-summary',
      method: 'GET',
      path: '/summary/daily',
      title: 'Bugungi kunlik hisobot & Kassa',
      desc: 'Bugungi jami savdo tushumi, sof foyda, naqd/click ulushi va omborning umumiy qiymati.',
      sampleCurl: `curl -H "X-API-Key: ${apiKey}" "${baseUrl}/summary/daily"`
    },
    {
      id: 'get-debts',
      method: 'GET',
      path: '/debts',
      title: 'Mijozlar nasiya daftari',
      desc: 'Faol nasiyalar ro\'yxati, qarzdorlik summasi va to\'lov muddatlari.',
      sampleCurl: `curl -H "X-API-Key: ${apiKey}" "${baseUrl}/debts?status=faol"`
    }
  ];

  const codeSnippets = {
    n8n: `// ⚡ n8n Workflow da ishlatish bo'yicha sozlamalar:
//
// 1. n8n da 'HTTP Request' nomli node qo'shing.
// 2. Sozlamalar:
//    - Method: GET (tovarlar olish) yoki POST (savdo yozish)
//    - URL: ${baseUrl}/products
//    - Authentication: Generic Credential Type -> Header Auth
//         Name: X-API-Key
//         Value: ${apiKey}
//    - (Ixtiyoriy) Query Parameters:
//         low_stock = true  (faqat kam qolgan tovarlar)
//         search = chexol   (qidiruv)
//
// 3. n8n ga to'g'ridan-to'g'ri nusxalab olish uchun tayyor JSON (Ctrl+V qiling):
{
  "nodes": [
    {
      "parameters": {
        "url": "${baseUrl}/products?low_stock=true",
        "headerParameters": {
          "parameters": [
            {
              "name": "X-API-Key",
              "value": "${apiKey}"
            }
          ]
        },
        "options": {}
      },
      "name": "Get Warehouse Stock",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [250, 300]
    }
  ]
}`,

    curl: `# 1. Barcha tovarlar va ombor qoldig'ini olish
curl -H "X-API-Key: ${apiKey}" \\
  "${baseUrl}/products"

# 2. Savdoni qayd etish (Sotuv cheki)
curl -X POST "${baseUrl}/sales" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "customerName": "Ali Valiyev",
    "paymentMethod": "click_payme",
    "items": [
      { "productId": "prod-1", "quantity": 1 }
    ]
  }'`,

    python: `import requests

API_KEY = "${apiKey}"
BASE_URL = "${baseUrl}"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# 1. Tovar qoldiqlarini tekshirish
response = requests.get(f"{BASE_URL}/products?low_stock=true", headers=headers)
print("Kam qolgan tovarlar:", response.json())

# 2. Yangi savdoni ro'yxatdan o'tkazish
sale_data = {
    "customerName": "Bot orqali buyurtma",
    "paymentMethod": "naqd",
    "items": [
        {"productId": "prod-1", "quantity": 2}
    ]
}
sale_res = requests.post(f"{BASE_URL}/sales", headers=headers, json=sale_data)
print("Savdo natijasi:", sale_res.json())`,

    javascript: `// Node.js yoki Brauzer orqali
const API_KEY = "${apiKey}";
const BASE_URL = "${baseUrl}";

// 1. Tovar qidirish
async function searchProduct(query) {
  const res = await fetch(\`\${BASE_URL}/products?search=\${encodeURIComponent(query)}\`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return await res.json();
}

// 2. Savdo chekini kiritish
async function createSale(cartItems, customerName = 'Mijoz') {
  const res = await fetch(\`\${BASE_URL}/sales\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      customerName,
      paymentMethod: 'click_payme',
      items: cartItems
    })
  });
  return await res.json();
}`,

    '1c': `// 1C: Korxona (1С:Предприятие 8.3) uchun integratsiya namunasi:
// HTTP-so'rov yaratish:
ServerManzili = "${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}";
HTTPUlanish = Yangi HTTPUlanish(ServerManzili, , , , , , Yangi HimoyalanganUlanishOpenSSL());

Sarlavhalar = Yangi Xarita();
Sarlavhalar.Qo'yish("X-API-Key", "${apiKey}");
Sarlavhalar.Qo'yish("Content-Type", "application/json; charset=utf-8");

So'rov = Yangi HTTPSo'rov("/api/v1/products", Sarlavhalar);
Javob = HTTPUlanish.Olish(So'rov);

Agar Javob.KodHolati = 200 Unda
    O'qishJSON = Yangi O'qishJSON();
    O'qishJSON.SatrniO'rnatish(Javob.MatnniOlish());
    Ma'lumotlar = O'qishJSON(O'qishJSON);
    // Ma'lumotlar.data ichida barcha tovarlar va qoldiqlar mavjud
TugashAgar;`
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-800 flex items-center justify-between bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  REST API & Tashqi Integratsiya
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  API v1 Faol (Online)
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                1C: Korxona, Telegram-bot, veb-sayt yoki boshqa kassa tizimlari bilan avtomatik ma'lumot almashinuvi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-sm custom-scrollbar">
          
          {/* Quick Credentials Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base URL */}
            <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
                <span className="flex items-center gap-1.5 text-stone-300 font-bold">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Server Bazaviy URL (Base URL)
                </span>
                <span className="text-[10px] bg-stone-800 px-1.5 py-0.5 rounded font-mono text-stone-400">HTTPS / HTTP</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={baseUrl}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700/70 font-mono text-xs text-cyan-300 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl ? 'Nusxalandi' : 'Nusxa'}
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                Barcha so'rovlar shu manzilga yo'naltiriladi
              </p>
            </div>

            {/* API Key */}
            <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  Xavfsiz API Kalit (Secret Key)
                </span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded font-mono">X-API-Key</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700/70 font-mono text-xs text-amber-300 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'Nusxalandi' : 'Nusxa'}
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                HTTP sarlavhasi: <code className="text-amber-400 font-mono">X-API-Key: {apiKey}</code>
              </p>
            </div>
          </div>

          {/* n8n & External Hosting Notice */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-stone-950 to-amber-950/30 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-cyan-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                n8n Agent & Tashqi Avtomatizatsiya uchun Cookie-siz Ochiq Manzil
              </span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold border border-cyan-500/30">
                CORS Faol
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              AI Studio development muhiti (<code>ais-dev-...</code>) brauzer cookie himoyasiga ega. n8n agenti, webhooklar yoki 1C bemalol, to'siqsiz ulanishi uchun dasturda <strong>CORS to'liq yoqildi</strong> va 3 ta oson yo'l mavjud:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800">
                <strong className="text-amber-300 block mb-1">1. Cloud Run (1-klik)</strong>
                <span>AI Studio yuqori o'ng burchagidagi <strong>Deploy</strong> orqali doimiy ochiq URL oling.</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800">
                <strong className="text-cyan-300 block mb-1">2. VPS / Railway / Render</strong>
                <span>Loyihadagi <code>Dockerfile</code> orqali istalgan serverda <code>docker compose up -d</code> qiling.</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800">
                <strong className="text-emerald-300 block mb-1">3. Ngrok / Cloudflare</strong>
                <span>Hozirroq test qilish uchun kompyuteringizda <code>ngrok http 3000</code> qilib ochiq URL oling.</span>
              </div>
            </div>
          </div>

          {/* Test & Sync Actions */}
          <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                API ni Jonli Sinash (Live Interactive Test)
              </h3>
              <p className="text-xs text-stone-400">
                Tugmani bosish orqali server API ga real so'rov yuborib ko'ring
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sinxronlanmoqda...' : 'Server bilan Sinxronlash'}
                </button>
              )}
              <button
                type="button"
                onClick={handleRunLiveTest}
                disabled={testStatus === 'loading'}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {testStatus === 'loading' ? 'Tekshirilmoqda...' : 'API ni Tekshirish (Ping)'}
              </button>
            </div>
          </div>

          {/* Live Test Output Window */}
          {testStatus !== 'idle' && (
            <div className={`p-4 rounded-2xl border ${
              testStatus === 'success' 
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' 
                : testStatus === 'error' 
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200' 
                  : 'bg-stone-950 border-stone-800 text-stone-300'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="flex items-center gap-1.5">
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                  {testStatus === 'loading' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
                  Server Javobi: {testStatus === 'success' ? '200 OK (Muvaffaqiyatli)' : testStatus === 'error' ? 'Xatolik' : 'Yuborilmoqda...'}
                </span>
                <span className="font-mono text-[10px] opacity-70">GET /api/v1/products?limit=2</span>
              </div>
              <pre className="text-xs font-mono bg-black/60 p-3 rounded-xl overflow-x-auto text-emerald-300 max-h-48 custom-scrollbar">
                {testResult || 'Serverdan ma\'lumot kutilmoqda...'}
              </pre>
            </div>
          )}

          {/* Integration Guides (3 Cards) */}
          <div>
            <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-3">
              Tashqi Dasturlarni Ulash Yo'riqnomasi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                  1C
                </div>
                <h4 className="font-bold text-white text-xs">1C: Korxona / Buxgalteriya</h4>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  1C dagi tovarlar qoldig'i yoki yangi kelgan partiyani <code className="text-amber-400">POST /products</code> orqali to'g'ridan-to'g'ri POS omboriga import qiling.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-white text-xs">Telegram Bot & Do'kon</h4>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Mijoz botdan chexol yoki zaryadnik so'rasa, <code className="text-amber-400">GET /products?search=...</code> orqali real qoldiq va narxini ko'rsating.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  <Database className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-white text-xs">Nasiya & Qarzlar Nazorati</h4>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  <code className="text-amber-400">GET /debts</code> orqali mijozlarning nasiyalarini avtomatik SMS-eslatma yoki Telegram bot orqali ogohlantiring.
                </p>
              </div>
            </div>
          </div>

          {/* Ready-to-use Code Examples with Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider">
                Tayyor Kod Namunalari (Code Snippets)
              </h3>
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
                {(['n8n', 'curl', 'python', 'javascript', '1c'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveLangTab(tab)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                      activeLangTab === tab
                        ? 'bg-amber-400 text-stone-950 shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative group">
              <pre className="p-4 rounded-2xl bg-stone-950 border border-stone-800 font-mono text-xs text-amber-200/90 overflow-x-auto max-h-64 leading-relaxed custom-scrollbar">
                {codeSnippets[activeLangTab]}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(codeSnippets[activeLangTab]);
                  alert('Kod nusxalandi!');
                }}
                className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Copy className="w-3.5 h-3.5" />
                Nusxa olish
              </button>
            </div>
          </div>

          {/* Endpoints List */}
          <div>
            <h3 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-3">
              Mavjud REST API Endpointlar Ro'yxati
            </h3>
            <div className="space-y-2">
              {endpoints.map((ep) => {
                const isExpanded = expandedEndpoint === ep.path;
                return (
                  <div 
                    key={ep.id}
                    className="rounded-2xl bg-stone-950/60 border border-stone-800/80 overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedEndpoint(isExpanded ? null : ep.path)}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-stone-900/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-black tracking-wider ${
                          ep.method === 'GET' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {ep.method}
                        </span>
                        <div>
                          <span className="font-mono text-xs font-bold text-white">{ep.path}</span>
                          <span className="text-xs text-stone-400 ml-2 hidden sm:inline">— {ep.title}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-stone-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-stone-800/60 space-y-3 bg-stone-950/40">
                        <p className="text-xs text-stone-300">{ep.desc}</p>
                        {ep.params && (
                          <div className="text-xs">
                            <span className="text-stone-400 font-bold block mb-1">Query parametrlar:</span>
                            <code className="text-cyan-300 font-mono text-[11px] bg-stone-900 px-2 py-1 rounded-md block">
                              {ep.params}
                            </code>
                          </div>
                        )}
                        {ep.body && (
                          <div className="text-xs">
                            <span className="text-stone-400 font-bold block mb-1">JSON So'rov tanasi (Body):</span>
                            <pre className="text-amber-300 font-mono text-[11px] bg-stone-900 p-2.5 rounded-xl overflow-x-auto">
                              {ep.body}
                            </pre>
                          </div>
                        )}
                        <div className="text-xs">
                          <span className="text-stone-400 font-bold block mb-1">cURL namunasi:</span>
                          <code className="text-stone-300 font-mono text-[11px] bg-stone-900 px-2.5 py-1.5 rounded-xl block overflow-x-auto">
                            {ep.sampleCurl}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Format: <strong className="text-white">JSON</strong> | Autentifikatsiya: <strong className="text-white">X-API-Key</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
