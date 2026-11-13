import { useEffect, useState } from 'react';

export function OfflineDevicePanel({ local }: { local: boolean }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('waiting');
  const [review, setReview] = useState(false);

  useEffect(() => {
    if (!local) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/device-sync/status', { signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          setStatus(result.status);
          setReview(Boolean(result.review));
        }
      } catch { /* The next poll retries. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [local]);

  async function pair() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/device-sync/pair', { method: 'POST' });
      if (!response.ok) throw new Error();
      setToken((await response.json()).token);
    } catch {
      setError("Ulash kodini olishda xato. Sahifani yangilab qayta urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  if (local) {
    const messages: Record<string, string> = {
      waiting: 'Mahalliy CRM · VPS tekshirilmoqda',
      synced: 'Mahalliy CRM · VPS bilan sinxronlandi',
      offline: 'Mahalliy CRM · VPS ulanmagan, yozuvlar shu kompyuterda saqlanmoqda',
      conflict: 'Ikkala bazada o‘zgarish bor. Nusxalar saqlandi, sinxronlash to‘xtadi.',
      unpaired: 'Qurilmaning VPS bilan ulanishi bekor qilingan. Mahalliy baza ishlayapti.'
    };
    return (
      <div role="status" className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">
        {messages[status]}
        {review && <div>Birlashtirishda farq topildi. Ikkala qiymat diskdagi device-conflicts papkasida saqlandi.</div>}
      </div>
    );
  }

  return (
    <section className="mb-4 space-y-2 rounded-xl border border-stone-200 bg-white p-4 text-sm">
      <h2 className="font-black">Internetsiz CRM</h2>
      <p className="text-stone-600">Shu Windows kompyuteriga o‘rnating. CRM ma’lumotlarni diskka yozadi va VPS ulansa sinxronlaydi.</p>
      <p className="text-xs text-stone-500">Yangilash uchun ZIP faylni qayta yuklang va o‘rnating. Yangi ulash kodi avvalgi qurilma ulanishini bekor qiladi.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/downloads/Mobile-Parts-CRM-Windows-x64.zip" download className="rounded-lg bg-amber-400 px-3 py-2 font-bold text-stone-950">Windows uchun yuklash</a>
        <button type="button" onClick={pair} disabled={busy || !!token} className="rounded-lg border border-stone-300 px-3 py-2 font-bold disabled:opacity-50">Ulash kodini olish</button>
      </div>
      {token && (
        <div className="space-y-1">
          <label htmlFor="offline-pair-code" className="block font-semibold">Ulash kodi</label>
          <input id="offline-pair-code" readOnly value={token} onFocus={e => e.currentTarget.select()} className="w-full rounded-lg border border-stone-300 p-2 font-mono text-xs" />
          <p className="text-xs text-stone-600">ZIP faylni oching, Install-CRM.cmd faylini ishga tushiring va kodni kiriting. Kodni faqat o‘rnatayotgan kompyuteringizda ishlating.</p>
        </div>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </section>
  );
}
