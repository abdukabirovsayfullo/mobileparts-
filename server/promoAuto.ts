import { dataStore, PromoSettings } from './dataStore';
import { sendTelegramPromoImages } from './telegram';
import { renderPromoImages } from './promoImage';
import { PromoGroupBy, buildPromoUnits, isAccessoryCategory, OTHER_TYPE, PromoUnit, promoCaption } from '../src/utils/promoCatalog';
import type { Product } from '../src/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHANNEL_RE = /^(@[A-Za-z0-9_]{4,}|-100\d{6,})$/;

export const isValidPromoChannel = (channel: string) => CHANNEL_RE.test(String(channel || '').trim());

const unitLabel = (key: string) => (key === OTHER_TYPE ? 'Boshqa' : key);

export function promoCaptionFor(category: string, unit: PromoUnit, by: PromoGroupBy, settings: PromoSettings) {
  const base = promoCaption(category, [], unit.sections, settings, new Date(), by === 'type' ? `${unitLabel(unit.key)} ekranlar` : unitLabel(unit.key));
  return settings.extra.trim() ? `${base}\n\n${settings.extra.trim()}`.slice(0, 1000) : base;
}

/** Omborda tovari bor kategoriyalar (sozlamadagi tartibda). */
export function promoCategories(products: Product[], categories: string[]): string[] {
  const set = new Set(products.filter((p) => p.stock > 0).map((p) => p.category));
  const ordered = categories.filter((c) => set.has(c));
  set.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
  return ordered;
}

export interface PromoJob {
  category: string;
  by: PromoGroupBy;
  keys?: string[];
  showWholesale?: boolean;
}

export async function renderPromoJob(job: PromoJob, settings = dataStore.getPromoSettings()) {
  const units = buildPromoUnits(dataStore.getProducts(), { category: job.category, by: job.by, keys: job.keys, inStockOnly: true });
  const showWholesale = job.showWholesale ?? isAccessoryCategory(job.category);
  const out: { unit: PromoUnit; images: Buffer[]; caption: string }[] = [];
  for (const unit of units) {
    const images = await renderPromoImages({ category: job.category, unit, showWholesale, contacts: settings });
    out.push({ unit, images, caption: promoCaptionFor(job.category, unit, job.by, settings) });
  }
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Telegram kanalga ~20 xabar/daqiqa cheklovi: har rasmdan keyin ~3 soniya kutiladi. */
export async function sendPromoJob(job: PromoJob, settings = dataStore.getPromoSettings()) {
  // Asosiy Telegram sozlamasidagi bot, bo'lmasa mijozlar boti.
  const token = dataStore.getTelegramConfig().botToken || (await import('./customerTelegram')).customerBotToken();
  const results: { key: string; images: number; ok: boolean; error?: string }[] = [];
  const rendered = await renderPromoJob(job, settings);
  for (let i = 0; i < rendered.length; i++) {
    const { unit, images, caption } = rendered[i];
    if (i > 0) await sleep(Math.max(3000, rendered[i - 1].images.length * 3000));
    const res = await sendTelegramPromoImages(token, settings.channel, { caption, images });
    results.push({ key: unit.key, images: images.length, ok: res.success, error: res.error });
    if (!res.success && /admin|token|Kanal manzili/i.test(res.error || '')) break; // sozlama xatosi — qolganini yubormaymiz
  }
  return results;
}

let running = false;

/** Barcha tanlangan kategoriyalar bo'yicha brendlarga ajratib kanalga yuboradi. */
export async function runPromoAuto(reason: 'jadval' | 'qolda'): Promise<string> {
  if (running) return 'Avtomatik reklama allaqachon yuborilmoqda.';
  running = true;
  const settings = dataStore.getPromoSettings();
  dataStore.setPromoSettings({ lastRunAt: new Date().toISOString(), lastResult: 'Yuborilmoqda…' });
  let summary = '';
  try {
    if (!isValidPromoChannel(settings.channel)) throw new Error("Kanal manzili noto'g'ri (@kanal_nomi).");
    const available = promoCategories(dataStore.getProducts(), dataStore.getCategories());
    const categories = settings.categories.length ? available.filter((c) => settings.categories.includes(c)) : available;
    if (!categories.length) throw new Error("Omborda tovar bor kategoriya topilmadi.");
    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const category of categories) {
      const results = await sendPromoJob({ category, by: 'brand' }, settings);
      sent += results.filter((r) => r.ok).length;
      failed += results.filter((r) => !r.ok).length;
      results.filter((r) => r.error).forEach((r) => errors.push(`${category} ${r.key}: ${r.error}`));
      if (results.some((r) => !r.ok && /admin|token|Kanal manzili/i.test(r.error || ''))) break;
      await sleep(5000);
    }
    summary = `${sent} ta post yuborildi${failed ? `, ${failed} ta xato` : ''}${errors.length ? ` (${errors[0]})` : ''}`;
  } catch (err: any) {
    summary = `Xato: ${err?.message || err}`;
  } finally {
    running = false;
  }
  const label = reason === 'jadval' ? 'Avtomatik' : "Qo'lda";
  dataStore.setPromoSettings({ lastResult: `${label}: ${summary}` });
  console.log(`[Promo] ${label}: ${summary}`);
  return summary;
}

const tashkentHour = (date: Date) => Number(date.toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false })) % 24;

/** Navbatdagi post vaqti keldimi: oxirgi postdan intervalDays o'tgan va Toshkentda belgilangan soat bo'lgan. */
export function promoAutoDue(settings: PromoSettings, now = new Date()): boolean {
  if (!settings.autoEnabled) return false;
  if (tashkentHour(now) < settings.hour) return false;
  if (!settings.lastRunAt) return true;
  const last = new Date(settings.lastRunAt).getTime();
  if (!Number.isFinite(last)) return true;
  // Soat oldinroq kelgan kunni ham hisoblash uchun 2 soat zaxira.
  return now.getTime() - last >= Math.max(1, settings.intervalDays) * DAY_MS - 2 * 60 * 60 * 1000;
}

/** Har 10 daqiqada jadvalni tekshiradi. Faqat asosiy serverda (lokal qurilmada emas). */
export function startPromoScheduler() {
  if (process.env.POS_LOCAL_DEVICE === '1') return;
  const tick = () => {
    try {
      if (!running && promoAutoDue(dataStore.getPromoSettings())) void runPromoAuto('jadval');
    } catch (err) {
      console.error('[Promo] Jadval xatosi:', err);
    }
  };
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 10 * 60 * 1000).unref?.();
}
