import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import { OTHER_TYPE, PromoGroupBy, buildPromoUnits, isAccessoryCategory, promoKeys, promoTotals } from '../utils/promoCatalog';
import { X, Megaphone, Send, Download, Settings2, Loader2, CheckCircle2, AlertTriangle, Smartphone, CalendarClock, Play } from 'lucide-react';

interface Props {
  products: Product[];
  categories: string[];
  onClose: () => void;
}

interface PromoSettings {
  title: string;
  phones: string;
  address: string;
  link: string;
  channel: string;
  extra: string;
  autoEnabled: boolean;
  intervalDays: number;
  hour: number;
  categories: string[];
  lastRunAt?: string;
  lastResult?: string;
}

type Rendered = { key: string; caption: string; images: string[] };
type Result = { key: string; images: number; ok: boolean; error?: string };

const unitLabel = (key: string) => (key === OTHER_TYPE ? 'Boshqa' : key);
const dateLabel = () => new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw Object.assign(new Error(body.error || `Server xatosi (${response.status})`), { body });
  return body as T;
};

/** Kanal uchun reklama rasmlari: kategoriya → brend (yoki ekran turi) bo'yicha, omborda borlari, qoldig'i bilan. */
export const PromoCatalogModal: React.FC<Props> = ({ products, categories, onClose }) => {
  const usedCategories = useMemo(() => {
    const set = new Set(products.filter((p) => p.stock > 0).map((p) => p.category));
    const ordered = categories.filter((c) => set.has(c));
    set.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }, [products, categories]);

  const [category, setCategory] = useState(usedCategories[0] || '');
  const [groupBy, setGroupBy] = useState<PromoGroupBy>('brand');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showWholesale, setShowWholesale] = useState(isAccessoryCategory(usedCategories[0] || ''));
  const [settings, setSettings] = useState<PromoSettings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [rendered, setRendered] = useState<Rendered[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [previewKey, setPreviewKey] = useState('');
  const [autoMessage, setAutoMessage] = useState('');
  const settingsLoaded = useRef(false);

  useEffect(() => {
    api<{ data: PromoSettings }>('/api/v1/promo/settings')
      .then((r) => { setSettings(r.data); settingsLoaded.current = true; })
      .catch((e) => setSettingsError(e.message));
  }, []);

  // Sozlamalar serverda saqlanadi — bot avtomatik post uchun shulardan foydalanadi.
  useEffect(() => {
    if (!settings || !settingsLoaded.current) return;
    const t = setTimeout(() => {
      const { lastRunAt: _a, lastResult: _b, ...patch } = settings;
      api('/api/v1/promo/settings', { method: 'PUT', body: JSON.stringify(patch) })
        .then(() => setSettingsError(''))
        .catch((e) => setSettingsError(e.message));
    }, 700);
    return () => clearTimeout(t);
  }, [settings]);

  const keys = useMemo(() => promoKeys(products, category, groupBy), [products, category, groupBy]);
  const units = useMemo(
    () => buildPromoUnits(products, { category, by: groupBy, keys: selectedKeys, inStockOnly: true }),
    [products, category, groupBy, selectedKeys]
  );

  // Oldindan ko'rish: rasmlarni server chizadi (kanalga ham aynan shu rasmlar ketadi).
  const renderKey = JSON.stringify([category, groupBy, selectedKeys, showWholesale, settings && [settings.title, settings.phones, settings.address, settings.link, settings.extra]]);
  useEffect(() => {
    if (!category || !settings) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setRendering(true);
      setRenderError('');
      api<{ data: Rendered[] }>('/api/v1/promo/render', {
        method: 'POST',
        body: JSON.stringify({ category, by: groupBy, keys: selectedKeys, showWholesale })
      })
        .then((r) => { if (!cancelled) setRendered(r.data); })
        .catch((e) => { if (!cancelled) { setRendered([]); setRenderError(e.message); } })
        .finally(() => { if (!cancelled) setRendering(false); });
    }, 900);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  const preview = rendered.find((r) => r.key === previewKey) || rendered[0];
  const imageCount = rendered.reduce((s, r) => s + r.images.length, 0);

  const changeCategory = (c: string) => {
    setCategory(c);
    setSelectedKeys([]);
    setShowWholesale(isAccessoryCategory(c));
    setResults([]);
  };
  const changeGroupBy = (by: PromoGroupBy) => {
    setGroupBy(by);
    setSelectedKeys([]);
    setResults([]);
  };
  const toggleKey = (k: string) => {
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
    setResults([]);
  };

  const download = (base64: string, name: string) => {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${base64}`;
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const fileName = (key: string, i: number, total: number) =>
    `${settings?.title || 'Narxlar'} - ${category} ${unitLabel(key)}${total > 1 ? ` (${i + 1})` : ''} - ${dateLabel().replace(/\./g, '-')}.png`.replace(/[\\/:*?"<>|]/g, ' ');

  const downloadAll = async () => {
    for (const r of rendered) {
      for (let i = 0; i < r.images.length; i++) {
        download(r.images[i], fileName(r.key, i, r.images.length));
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
  };

  const send = async () => {
    if (!units.length || busy || !settings) return;
    if (!window.confirm(`${units.length} ta post (${units.map((u) => unitLabel(u.key)).join(', ')}) ${settings.channel} kanaliga yuborilsinmi?`)) return;
    setResults([]);
    setBusy(`${units.length} ta post kanalga yuborilmoqda…`);
    try {
      const r = await api<{ results: Result[] }>('/api/v1/promo/send', {
        method: 'POST',
        body: JSON.stringify({ category, by: groupBy, keys: selectedKeys, showWholesale })
      });
      setResults(r.results);
    } catch (e: any) {
      if (Array.isArray(e.body?.results)) setResults(e.body.results);
      else alert(e.message);
    } finally {
      setBusy('');
    }
  };

  const runAutoNow = async () => {
    if (!settings) return;
    const cats = settings.categories.length ? settings.categories.join(', ') : 'barcha kategoriyalar';
    if (!window.confirm(`${cats} — barcha brendlar ${settings.channel} kanaliga hozir yuborilsinmi?`)) return;
    try {
      const r = await api<{ message: string }>('/api/v1/promo/auto/run', { method: 'POST' });
      setAutoMessage(r.message);
    } catch (e: any) {
      setAutoMessage(e.message);
    }
  };

  const toggleAutoCategory = (c: string) => {
    if (!settings) return;
    const list = settings.categories.includes(c) ? settings.categories.filter((x) => x !== c) : [...settings.categories, c];
    setSettings({ ...settings, categories: list });
  };

  const nextRun = (() => {
    if (!settings?.autoEnabled) return '';
    const base = settings.lastRunAt ? new Date(settings.lastRunAt).getTime() + settings.intervalDays * 86400000 : Date.now();
    const d = new Date(base);
    return `${d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' })}, soat ${String(settings.hour).padStart(2, '0')}:00 dan keyin`;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 bg-stone-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center"><Megaphone className="w-5 h-5 text-stone-950" /></div>
            <div>
              <h3 className="font-black text-sm">Kanal uchun reklama rasmlari</h3>
              <div className="text-[11px] text-stone-400">Brend bo'yicha · faqat omborda borlari, qoldig'i bilan · har brendga alohida post</div>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white cursor-pointer" aria-label="Yopish"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Boshqaruv */}
          <div className="lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200 p-4 space-y-4 overflow-y-auto text-xs max-h-[50vh] lg:max-h-none">
            <label className="block">
              <span className="font-bold text-stone-700">Kategoriya</span>
              <select value={category} onChange={(e) => changeCategory(e.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-sm">
                {usedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-stone-700">{groupBy === 'type' ? 'Ekran turi' : 'Brend'}</span>
                <span className="flex rounded-lg border border-stone-300 overflow-hidden text-[10px] font-bold">
                  {(['brand', 'type'] as const).map((by) => (
                    <button key={by} type="button" onClick={() => changeGroupBy(by)}
                      className={`px-2 py-0.5 cursor-pointer ${groupBy === by ? 'bg-stone-950 text-amber-400' : 'bg-white text-stone-600'}`}>
                      {by === 'type' ? 'Tur' : 'Brend'}
                    </button>
                  ))}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {keys.map((k) => {
                  const on = selectedKeys.includes(k.key);
                  return (
                    <button key={k.key} type="button" onClick={() => toggleKey(k.key)}
                      className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${on ? 'bg-amber-400 border-amber-500 text-stone-950' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                      {unitLabel(k.key)} <span className="opacity-60">{k.count}</span>
                    </button>
                  );
                })}
                {keys.length === 0 && <span className="text-stone-400">Bu kategoriyada omborda tovar yo'q</span>}
              </div>
              <div className="mt-1 text-[10px] text-stone-500 flex justify-between">
                <span>{selectedKeys.length ? `${selectedKeys.length} ta tanlandi` : 'Hech biri tanlanmasa — hammasi'}</span>
                {selectedKeys.length > 0 && <button onClick={() => setSelectedKeys([])} className="text-amber-700 font-bold cursor-pointer">Tozalash</button>}
              </div>
            </div>

            <label className="flex items-center gap-2 font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={showWholesale} onChange={(e) => setShowWholesale(e.target.checked)} />
              Optom narxni ham ko'rsatish
            </label>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-0.5">
              <div className="font-black text-stone-800">{units.length} ta post · {imageCount || '…'} ta rasm · {units.reduce((s, u) => s + promoTotals(u.sections).models, 0)} xil model</div>
              <div className="text-stone-500">{units.map((u) => `${unitLabel(u.key)} (${promoTotals(u.sections).models})`).join(', ') || '—'}</div>
            </div>

            {settings && (
              <label className="block">
                <span className="font-bold text-stone-700">Postga qo'shimcha matn (ixtiyoriy)</span>
                <textarea value={settings.extra} onChange={(e) => setSettings({ ...settings, extra: e.target.value })} rows={2}
                  placeholder="Masalan: Ustalarga maxsus chegirma!" className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-xl" />
              </label>
            )}

            <div className="space-y-2 pt-1">
              <button type="button" disabled={!units.length || !!busy || !settings} onClick={send}
                className="w-full py-3 rounded-xl bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-amber-400 font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Send className="w-4 h-4" /> Kanalga yuborish ({units.length})
              </button>
              <button type="button" disabled={!rendered.length || rendering} onClick={downloadAll}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-stone-950 font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Download className="w-4 h-4" /> Rasmlarni yuklab olish ({imageCount})
              </button>
              {busy && <div className="flex items-center gap-2 font-bold text-stone-600"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</div>}
            </div>

            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div key={r.key} className={`rounded-xl border px-3 py-2 ${r.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="font-black flex items-center gap-1.5">
                      {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                      {unitLabel(r.key)} · {r.images} rasm
                    </div>
                    {r.ok ? <div className="text-emerald-700 font-semibold">Kanalga yuborildi</div> : <div className="text-red-700 font-semibold">{r.error}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Avtomatik post */}
            {settings && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-3 space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="flex items-center gap-1.5 font-black text-stone-900 text-sm"><CalendarClock className="w-4 h-4 text-amber-600" /> Bot avtomatik post qilsin</span>
                  <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={settings.autoEnabled} onChange={(e) => setSettings({ ...settings, autoEnabled: e.target.checked })} />
                </label>
                <div className="text-stone-600">Bot belgilangan kunda {settings.channel} kanaliga har kategoriyani brendlarga bo'lib, rasmlar bilan joylaydi.</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="font-semibold text-stone-600">Har necha kunda</span>
                    <input type="number" min={1} max={30} value={settings.intervalDays}
                      onChange={(e) => setSettings({ ...settings, intervalDays: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                      className="mt-0.5 w-full px-2.5 py-1.5 border border-stone-300 rounded-lg font-bold" />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-stone-600">Soat (Toshkent)</span>
                    <select value={settings.hour} onChange={(e) => setSettings({ ...settings, hour: Number(e.target.value) })}
                      className="mt-0.5 w-full px-2.5 py-1.5 border border-stone-300 rounded-lg font-bold bg-white">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                  </label>
                </div>
                <div>
                  <div className="font-semibold text-stone-600">Kategoriyalar <span className="text-stone-400">(tanlanmasa — hammasi)</span></div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {usedCategories.map((c) => {
                      const on = settings.categories.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleAutoCategory(c)}
                          className={`px-2 py-0.5 rounded-lg font-bold border cursor-pointer ${on ? 'bg-stone-950 border-stone-950 text-amber-400' : 'bg-white border-stone-300 text-stone-700'}`}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {settings.autoEnabled && <div className="font-bold text-amber-800">Navbatdagi post: {nextRun}</div>}
                {settings.lastRunAt && (
                  <div className="text-stone-600">
                    Oxirgi: {new Date(settings.lastRunAt).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}
                    {settings.lastResult ? ` — ${settings.lastResult}` : ''}
                  </div>
                )}
                <button type="button" onClick={runAutoNow}
                  className="w-full py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-black inline-flex items-center justify-center gap-1.5 cursor-pointer">
                  <Play className="w-3.5 h-3.5" /> Hozir hammasini yuborish
                </button>
                {autoMessage && <div className="font-semibold text-stone-700">{autoMessage}</div>}
              </div>
            )}

            <button type="button" onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1.5 font-bold text-stone-600 hover:text-stone-900 cursor-pointer">
              <Settings2 className="w-4 h-4" /> Do'kon ma'lumotlari va kanal
            </button>
            {showSettings && settings && (
              <div className="space-y-2">
                {([
                  ['title', 'Sarlavha'], ['phones', 'Telefonlar (vergul bilan)'], ['address', 'Manzil'], ['link', 'Havola'], ['channel', 'Kanal (@nomi)']
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-stone-500 font-semibold">{label}</span>
                    <input value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-0.5 w-full px-2.5 py-1.5 border border-stone-300 rounded-lg" />
                  </label>
                ))}
              </div>
            )}
            {settingsError && <div className="text-red-700 font-semibold">{settingsError}</div>}
          </div>

          {/* Oldindan ko'rish */}
          <div className="flex-1 min-w-0 bg-stone-200/70 overflow-auto p-4">
            {rendered.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {rendered.map((r) => (
                  <button key={r.key} onClick={() => setPreviewKey(r.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${preview?.key === r.key ? 'bg-stone-950 text-amber-400' : 'bg-white text-stone-700'}`}>
                    {unitLabel(r.key)} <span className="opacity-60">{r.images.length}</span>
                  </button>
                ))}
              </div>
            )}
            {rendering && (
              <div className="flex items-center gap-2 font-bold text-stone-600 mb-3"><Loader2 className="w-4 h-4 animate-spin" /> Rasmlar tayyorlanmoqda…</div>
            )}
            {renderError && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-xs p-3">{renderError}</div>}
            {!units.length && (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 gap-2">
                <Smartphone className="w-10 h-10" /> Tanlangan kategoriyada omborda tovar yo'q
              </div>
            )}
            {preview && units.length > 0 && (
              <div className={`space-y-4 ${rendering ? 'opacity-50' : ''}`}>
                {preview.images.map((img, i) => (
                  <div key={i} className="mx-auto max-w-[540px] relative group">
                    <img src={`data:image/png;base64,${img}`} alt={`${unitLabel(preview.key)} ${i + 1}`} className="w-full rounded-xl shadow-xl bg-white" />
                    <button onClick={() => download(img, fileName(preview.key, i, preview.images.length))}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-white/90 text-stone-900 text-[11px] font-black shadow cursor-pointer inline-flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> PNG
                    </button>
                  </div>
                ))}
                <div className="mx-auto max-w-[540px] bg-white rounded-2xl p-3 text-[11px] whitespace-pre-wrap text-stone-700 shadow">
                  <div className="font-black text-stone-500 mb-1">Post matni:</div>
                  {preview.caption}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
