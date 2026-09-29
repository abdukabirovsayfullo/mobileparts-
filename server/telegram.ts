import { Product } from '../src/types';
import { dataStore, TelegramConfig } from './dataStore';

/**
 * Sends a message via Telegram Bot API.
 */
export async function sendTelegramRawMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  if (!cleanToken) {
    return { success: false, error: "Telegram Bot Token kiritilmagan" };
  }
  if (!cleanChatId) {
    return { success: false, error: "Telegram Chat ID kiritilmagan" };
  }

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    if (!result.ok) {
      return {
        success: false,
        error: result.description || `Telegram API xatosi (${result.error_code || response.status})`
      };
    }

    return {
      success: true,
      messageId: result.result?.message_id
    };
  } catch (err: any) {
    console.error('[Telegram API] Error sending message:', err);
    return {
      success: false,
      error: err.message || "Telegram serveri bilan bog'lanishda xatolik yuz berdi"
    };
  }
}

/**
 * Format Uzbek monetary amount.
 */
function formatSum(amount: number): string {
  return Number(amount || 0).toLocaleString('uz-UZ') + " so'm";
}

/**
 * Formats a clean HTML message for low stock products.
 */
export function buildLowStockTelegramMessage(products: Product[], storeName: string = 'Paxtaobod Beeline'): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (products.length === 0) {
    return `✅ <b>${storeName} — Barcha tovarlar zaxirasi yetarli!</b>\n\n📅 Sana: ${formattedDate}\nOmborda kam qolgan yoki tugagan tovarlar yo'q. Barcha mahsulotlar belgilangan minimal zaxira miqdorida mavjud.`;
  }

  let text = `🚨 <b>DIQQAT: ${storeName} — OZAYGAN TOVARLAR OGOHLANTIRISHI!</b>\n`;
  text += `📅 <i>Sana: ${formattedDate}</i>\n`;
  text += `📦 <b>Kam qolgan tovarlar soni:</b> ${products.length} ta\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  products.slice(0, 30).forEach((item, idx) => {
    const isZero = item.stock <= 0;
    const icon = isZero ? '🔴' : '⚠️';
    const statusText = isZero ? '<b>TUGAGAN (0 dona)</b>' : `<b>${item.stock} dona</b> qoldi`;
    
    // Suggested procurement calculation (order up to 3x minStockAlert, min 10)
    const suggestedOrder = Math.max(10, (item.minStockAlert || 5) * 3 - Math.max(0, item.stock));

    text += `${icon} <b>${idx + 1}. ${escapeHtml(item.name)}</b>\n`;
    text += `   • Toifa: <i>${escapeHtml(item.category || 'Aksessuarlar')}</i>\n`;
    text += `   • Qoldiq: ${statusText} (Chegara: ${item.minStockAlert || 5} dona)\n`;
    text += `   • Narxi: Tan ${formatSum(item.purchasePrice)} | Sotish ${formatSum(item.sellingPrice)}\n`;
    text += `   • 💡 <b>Tavsiya etilgan zakaz:</b> <code>+${suggestedOrder} dona</code>\n\n`;
  });

  if (products.length > 30) {
    text += `<i>...va yana ${products.length - 30} ta kam qolgan tovarlar mavjud. To'liq ro'yxatni do'kon ilovasi yoki API orqali ko'ring.</i>\n\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🤖 <i>Ushbu xabar Paxtaobod Beeline POS avtomatik tahlil tizimi tomonidan shakllantirildi.</i>`;

  return text;
}

/**
 * Formats a clean HTML message for AI Business Analysis & Procurement Advice.
 */
export function buildAiReportTelegramMessage(
  summaryData: {
    mistakes: string[];
    orderMore: Array<{ name: string; quantity: number; reason: string }>;
    orderLess: Array<{ name: string; reason: string }>;
    goldenRules: string[];
    overviewText?: string;
  },
  storeName: string = 'Paxtaobod Beeline'
): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let text = `🧠 <b>${storeName} — SUN'IY INTELLEKT BIZNES TAHLILI VA XARID MASLAHATI</b>\n`;
  text += `📅 <i>Sana: ${formattedDate}</i>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (summaryData.overviewText) {
    text += `📋 <b>Umumiy Xulosa:</b>\n${escapeHtml(summaryData.overviewText)}\n\n`;
  }

  // 1. Mistakes
  text += `❌ <b>SAVDODAGI ASOSIY XATOLARIMIZ (Diagnostika):</b>\n`;
  if (summaryData.mistakes.length > 0) {
    summaryData.mistakes.forEach((m, i) => {
      text += `${i + 1}. ⚠️ ${escapeHtml(m)}\n`;
    });
  } else {
    text += `<i>Jiddiy xatolar aniqlanmadi. Savdo barqaror ketmoqda.</i>\n`;
  }
  text += `\n`;

  // 2. Order More
  text += `🟢 <b>KO'PROQ ZAKAZ QILINISHI KERAK BO'LGANLAR (Xaridorgir):</b>\n`;
  if (summaryData.orderMore.length > 0) {
    summaryData.orderMore.slice(0, 10).forEach((item, i) => {
      text += `${i + 1}. <b>${escapeHtml(item.name)}</b>: <code>+${item.quantity} dona</code>\n`;
      text += `   <i>Sabab: ${escapeHtml(item.reason)}</i>\n`;
    });
  } else {
    text += `<i>Hozircha barcha yetakchi tovarlar omborda yetarli.</i>\n`;
  }
  text += `\n`;

  // 3. Order Less / Stop
  text += `🛑 <b>OZROQ / UMUMAN ZAKAZ QILINMAYDIGANLAR (O'lik Zaxira):</b>\n`;
  if (summaryData.orderLess.length > 0) {
    summaryData.orderLess.slice(0, 8).forEach((item, i) => {
      text += `${i + 1}. <b>${escapeHtml(item.name)}</b>\n`;
      text += `   <i>Sabab: ${escapeHtml(item.reason)}</i>\n`;
    });
  } else {
    text += `<i>Omborda haddan tashqari qotib qolgan o'lik tovarlar yo'q.</i>\n`;
  }
  text += `\n`;

  // 4. Golden Rules for Future
  text += `💡 <b>KELAJAKDAGI XATOLARDAN HIMOYaLANISh QOIDALARI:</b>\n`;
  if (summaryData.goldenRules.length > 0) {
    summaryData.goldenRules.forEach((r, i) => {
      text += `• ${escapeHtml(r)}\n`;
    });
  }
  text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📱 <i>Paxtaobod Beeline POS — AI Smart Assistant</i>`;

  return text;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends low stock notification using configured credentials.
 */
export async function sendLowStockNotification(overrideConfig?: Partial<TelegramConfig>): Promise<{ success: boolean; message?: string; count?: number }> {
  const currentConfig = dataStore.getTelegramConfig();
  const token = overrideConfig?.botToken || currentConfig.botToken;
  const chatId = overrideConfig?.chatId || currentConfig.chatId;

  if (!token || !chatId) {
    return {
      success: false,
      message: "Telegram Bot Token yoki Chat ID sozlanmagan. Iltimos, sozlamalar bo'limida kiriting."
    };
  }

  const products = dataStore.getProducts();
  const lowStockProducts = products.filter(p => p.stock <= (p.minStockAlert || 5));
  const storeInfo = dataStore.getState().storeInfo;
  const storeName = storeInfo?.name || 'Paxtaobod Beeline';

  const messageText = buildLowStockTelegramMessage(lowStockProducts, storeName);
  const result = await sendTelegramRawMessage(token, chatId, messageText, 'HTML');

  if (result.success) {
    dataStore.setTelegramConfig({ lastAlertSentAt: new Date().toISOString() });
    return {
      success: true,
      count: lowStockProducts.length,
      message: `${lowStockProducts.length} ta ozaygan tovarlar haqida Telegramga xabar muvaffaqiyatli yuborildi!`
    };
  }

  return {
    success: false,
    message: result.error || "Telegramga xabar yuborishda xatolik yuz berdi"
  };
}
