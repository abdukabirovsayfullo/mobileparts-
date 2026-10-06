const RATE_KEY = 'mobileparts.usdRate';

/** Dollarni so'mga o'giradi (butun so'mgacha yaxlitlanadi). */
export function usdToUzs(usd: number, rate: number): number {
  return Math.max(0, Math.round((Number(usd) || 0) * (Number(rate) || 0)));
}

/** So'mni dollarga o'giradi (sent aniqligida). */
export function uzsToUsd(uzs: number, rate: number): number {
  return rate > 0 ? Math.round(((Number(uzs) || 0) / rate) * 100) / 100 : 0;
}

/** Oxirgi kiritilgan kurs (brauzerda saqlanadi); yo'q bo'lsa 0 — foydalanuvchi o'zi kiritadi. */
export function loadUsdRate(): number {
  try {
    const value = Number(localStorage.getItem(RATE_KEY));
    return value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveUsdRate(rate: number): void {
  try {
    if (rate > 0) localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    // saqlanmasa ham kirim ishlayveradi
  }
}