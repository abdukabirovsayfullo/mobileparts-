import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import { apiV1Router } from "./server/apiV1";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PRIMARY_POS_URL = "https://77-81-138-243.sslip.io";

// Security: Hide Express framework signature
app.disable("x-powered-by");

// Basic security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// The old Render deployment is kept only as a redirect so every bookmark and
// installed shortcut lands on the owner's VPS, which is the single source of truth.
app.use((req: Request, res: Response, next: NextFunction) => {
  const forwardedHost = req.headers["x-forwarded-host"];
  const rawHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host || "";
  const hostname = rawHost.split(",")[0].trim().split(":")[0].toLowerCase();

  if (hostname === "mobileparts-pos.onrender.com") {
    return res.redirect(308, new URL(req.originalUrl, PRIMARY_POS_URL).toString());
  }

  next();
});

// CORS: Allow external automation tools (n8n, webhooks, 1C, mobile apps) to access API without cookie restrictions
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, Accept, Origin");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Protect only specific sensitive root files
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path.toLowerCase();
  if (p === "/.env" || p === "/metadata.json" || p === "/package.json") {
    return res.status(403).json({ error: "Access Denied" });
  }
  next();
});

// In-memory IP Rate Limiter (Prevents DDoS, API Key exhaustion, and automated spam)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const ipRequestMap = new Map<string, RateLimitRecord>();
const geminiRequestMap = new Map<string, RateLimitRecord>();

// Cleanup stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestMap.entries()) {
    if (now > record.resetTime) ipRequestMap.delete(ip);
  }
  for (const [ip, record] of geminiRequestMap.entries()) {
    if (now > record.resetTime) geminiRequestMap.delete(ip);
  }
}, 5 * 60 * 1000);

function rateLimit(map: Map<string, RateLimitRecord>, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "127.0.0.1";
    const now = Date.now();
    const record = map.get(ip);

    if (!record || now > record.resetTime) {
      map.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        success: false,
        error: `Juda ko'p so'rov yuborildi. Iltimos, ${retryAfterSec} soniyadan keyin qayta urinib ko'ring.`
      });
    }

    record.count += 1;
    next();
  };
}

// Several POS phones can share one shop IP. Background sync alone used to hit
// 120/minute and intermittently return 429, so keep a safe shared-IP ceiling.
app.use("/api/", rateLimit(ipRequestMap, 600, 60 * 1000));

// Specific strict rate limit for AI OCR: 20 image parses per minute
const geminiRateLimiter = rateLimit(geminiRequestMap, 20, 60 * 1000);

// Payload size limit restricted to 15MB (sufficient for 4K photos, prevents memory exhaustion DoS)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY muhit o'zgaruvchisi topilmadi.");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// Mount POS REST API v1 (Products, Sales, Stock Movements, Debts, Summary & Docs)
app.use("/api/v1", apiV1Router);

// Convenient alias for Telegram Mini App integrations
app.use("/api/telegram", (req, res, next) => {
  req.url = `/telegram/miniapp${req.url === '/' ? '' : req.url}`;
  apiV1Router(req, res, next);
});

// Gemini AI OCR & Handwritten Invoice Parsing endpoint with strict input sanitization
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/jpg"
]);

app.post("/api/gemini/parse-receipt", geminiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, currentCategories, customInstructions } = req.body;

    // 1. Validate image payload presence and type
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error: "Fotosurat ma'lumoti (imageBase64) yuborilmadi."
      });
    }

    // 2. Validate max base64 size (prevent memory overflow)
    if (imageBase64.length > 14 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "Fotosurat hajmi juda katta (maksimal ruxsat: 10MB)."
      });
    }

    // 3. Clean and validate base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    if (!cleanBase64 || cleanBase64.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Fotosurat base64 formati noto'g'ri."
      });
    }

    // 4. Validate MIME type
    const effectiveMimeType = (mimeType || "image/jpeg").toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIMES.has(effectiveMimeType)) {
      return res.status(400).json({
        success: false,
        error: "Faqat rasm fayllari (JPEG, PNG, WEBP) qabul qilinadi."
      });
    }

    // 5. Sanitize and validate categories array
    let categoryListStr = "Chexollar, Himoya Oynalari, Zaryadniklar, Kabellar, Quloqchinlar, Powerbanklar, Avto Aksessuarlar, Beeline Xizmatlari, Gadjetlar";
    if (Array.isArray(currentCategories)) {
      const sanitizedCats = currentCategories
        .slice(0, 40)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.slice(0, 50).trim().replace(/[<>'"`;]/g, ""));
      if (sanitizedCats.length > 0) {
        categoryListStr = sanitizedCats.join(", ");
      }
    }

    // 6. Sanitize custom instructions to mitigate prompt injection
    let sanitizedInstructions = "";
    if (typeof customInstructions === "string") {
      sanitizedInstructions = customInstructions
        .slice(0, 300)
        .replace(/[\r\n\t]/g, " ")
        .replace(/[<>{}[\]]/g, "");
    }

    const ai = getGenAI();

    const systemPrompt = `Siz O'zbekistondagi telefon aksessuarlari va gadjetlar savdo do'koni ('Paxtaobod Beeline Aksessuarlar') uchun ixtisoslashgan yuqori aniqlikdagi sun'iy intellekt hisobchisisiz.
Vazifangiz: Fotosuratdagi qog'oz nakladnoy, tovar kvitansiyasi, kassa cheki yoki daftarga qo'lda (ruchka, qalam) yozilgan yangi kelgan tovarlar ro'yxatini to'liq o'qib, omborga kirim (prikhod) qilish uchun strukturalangan JSON formatga ajratish.

Yozuv xususiyatlari:
- O'zbekcha, ruscha yoki qisqartma so'zlar: 'dona', 'ta', 'sht', 'ming', 'k', 'optom', 'tan narxi', 'prikhod'.
- Masalan: 'Remax 20W 15 ta 45000', 'iPhone 13 chexol 25x15000', '9D shisha 50 dona 6 ming', 'Hoco C12 adapter 10 dona 35 ming'.
- Tan narxi (costPrice) odatda so'mda ifodalangan (masalan 45 ming -> 45000).
- Agar sotish narxi hujjatda yozilmagan bo'lsa, tan narxiga real 40%-65% qo'shib, sotish narxini (sellingPrice) ming so'mgacha yaxlitlab hisoblang.
- Ulgurji (wholesalePrice) narxini esa tan narxi va chakana narxi o'rtasidagi miqdor qilib belgilang.
- Do'kondagi mavjud kategoriyalar: [${categoryListStr}]. Har bir tovarga mos keluvchi kategoriyani aniqlang.
- Tovar brendini (Remax, Hoco, Borofone, Apple, Samsung, Celebrat, Joyroom, Bavin, Universal va h.k.) aniqlang.`;

    const contents = {
      parts: [
        {
          inlineData: {
            mimeType: effectiveMimeType,
            data: cleanBase64
          }
        },
        {
          text: `Iltimos, ushbu fotosuratdagi barcha tovarlarni, ularning dona soni va narxlarini o'qib, JSON schema bo'yicha to'liq ajratib bering. ${sanitizedInstructions}`
        }
      ]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: {
              type: Type.STRING,
              description: "Hujjatda ko'rsatilgan ta'minotchi yoki baza nomi. Agar aniqlanmasa 'Ulgurji Ta\\'minotchi'"
            },
            date: {
              type: Type.STRING,
              description: "Nakladnoy yoki yozuv sanasi (agar ko'rinsa)"
            },
            totalSum: {
              type: Type.NUMBER,
              description: "Hujjatdagi jami ko'rsatilgan umumiy summa (agar yozilgan bo'lsa)"
            },
            notes: {
              type: Type.STRING,
              description: "Qog'ozdagi qo'shimcha eslatmalar yoki qarz shartlari"
            },
            items: {
              type: Type.ARRAY,
              description: "Aniqlangan tovarlar ro'yxati",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Aniq va to'g'ri yozilgan tovar nomi"
                  },
                  quantity: {
                    type: Type.INTEGER,
                    description: "Necha dona yoki quti olingan (musbat butun son)"
                  },
                  costPrice: {
                    type: Type.NUMBER,
                    description: "Bitta tovarning tan/kelish narxi so'mda"
                  },
                  sellingPrice: {
                    type: Type.NUMBER,
                    description: "Tavsiya etilgan yoki ko'rsatilgan chakana sotish narxi so'mda"
                  },
                  wholesalePrice: {
                    type: Type.NUMBER,
                    description: "Optom narxi so'mda"
                  },
                  category: {
                    type: Type.STRING,
                    description: "Do'kon kategoriyalaridan eng mos kelgani"
                  },
                  brand: {
                    type: Type.STRING,
                    description: "Aksessuar brendi"
                  },
                  rawLine: {
                    type: Type.STRING,
                    description: "Qog'ozdagi asl o'qilgan qator matni"
                  }
                },
                required: ["name", "quantity", "costPrice", "category"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      data: parsedData
    });
  } catch (error: any) {
    // Never expose stack trace or API credentials to client
    console.error("Gemini OCR error (internal):", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Fotosuratni o'qishda xatolik yuz berdi. Iltimos, rasm ravshanligini tekshirib qaytadan urinib ko'ring."
    });
  }
});

// Fallback for unhandled API routes (prevents leaking SPA HTML on missing API endpoints)
app.all("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "API endpoint topilmadi" });
});

// Vite middleware for development & static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { dotfiles: "ignore", index: ["index.html"] }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Secure server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
