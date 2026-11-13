import { useEffect, useRef } from 'react';

/**
 * Qiymatni localStorage'ga kechiktirib yozadi: har o'zgarishda emas, o'zgarishlar to'xtagach bir marta.
 * Katta ro'yxatlarni (tovar, harakat) har safar JSON'ga o'girish sahifani qotirardi.
 * Sahifa yopilganda yoki yashirilganda kutilayotgan yozuv darhol bajariladi.
 */
export function useDebouncedStorage(key: string, value: unknown, enabled = true, delayMs = 1500): void {
  const latest = useRef(value);
  const dirty = useRef(false);
  latest.current = value;

  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch {
      /* joy yetmasa yoki bloklangan bo'lsa, server nusxasi bor */
    }
  };

  useEffect(() => {
    if (!enabled) return;
    dirty.current = true;
    const timer = window.setTimeout(flush, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, enabled, delayMs]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [enabled]);
}
