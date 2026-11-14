import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import { formatMoney } from '../utils/formatters';
import {
  OTHER_TYPE, PromoContacts, PromoGroupBy, PromoRow, PromoUnit, buildPromoUnits, isAccessoryCategory, paginatePromo, promoCaption, promoGroupMode, promoKeys, promoTotals
} from '../utils/promoCatalog';
import { X, Megaphone, Send, Download, Settings2, Loader2, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';

interface Props {
  products: Product[];
  categories: string[];
  onClose: () => void;
}

const SETTINGS_KEY = 'mp.promo.settings.v1';
const DEFAULT_SETTINGS: PromoContacts & { channel: string; extra: string } = {
  title: 'MobileParts Paxtaobod',
  phones: '+998 95 200 13 33, +998 91 174 13 33',
  address: "Paxtaobod, Beeline ofisi · Yoqubov stoyankasi yonida",
  link: 't.me/mobilepartsuz',
  channel: '@mobilepartsuz',
  extra: ''
};
const loadSettings = () => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return DEFAULT_SETTINGS; }
};

const PAGE_W = 794;
const PAGE_H = 1123;
const ROWS_PER_PAGE = 26;

type Result = { key: string; pages: number; models: number; status: 'tayyor' | 'yuborildi' | 'xato'; error?: string; pdf?: Blob; fileName: string };

const unitLabel = (key: string) => (key === OTHER_TYPE ? 'Boshqa' : key);

const dateLabel = () => new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });

const stockBadge = (n: number) =>
  n >= 5 ? { bg: '#dcfce7', fg: '#166534' } : n > 0 ? { bg: '#fef3c7', fg: '#92400e' } : { bg: '#e7e5e4', fg: '#57534e' };

/** Bitta A4 sahifa (794×1123 px). html2canvas shu elementni rasmga aylantiradi. */
const PromoPage: React.FC<{
  rows: PromoRow[]; page: number; total: number; category: string; unit: PromoUnit; showWholesale: boolean; contacts: PromoContacts;
}> = ({ rows, page, total, category, unit, showWholesale, contacts }) => {
  const totals = promoTotals(unit.sections);
  const showSections = unit.sections.length > 1;
  const cols = showWholesale ? '44px 1fr 86px 128px 128px' : '44px 1fr 96px 150px';
  return (
    <div style={{ width: PAGE_W, height: PAGE_H, background: '#ffffff', color: '#1c1917', fontFamily: 'Inter, "Segoe UI", Arial, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', lineHeight: 1.3 }}>
      {/* Sarlavha */}
      <div style={{ background: '#0c0a09', color: '#fff', padding: '26px 34px 22px', display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
        <div style={{ position: 'absolute', right: -70, top: -90, width: 220, height: 220, borderRadius: 110, background: '#1c1917' }} />
        <div style={{ width: 62, height: 62, borderRadius: 16, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0c0a09" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /><circle cx="12" cy="10" r="2.6" /><path d="M12 6.2v1.2M12 12.6v1.2M8.2 10h1.2M14.6 10h1.2" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: '34px', height: 34, whiteSpace: 'nowrap' }}>{contacts.title}</div>
          <div style={{ marginTop: 8, height: 28, lineHeight: '28px', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'top', background: '#fbbf24', color: '#0c0a09', fontWeight: 900, fontSize: 15, height: 28, lineHeight: '15px', padding: '0 12px 2px', borderRadius: 8, textTransform: 'uppercase' }}>{category}</span>
            <span style={{ display: 'inline-block', verticalAlign: 'top', marginLeft: 10, fontSize: 20, fontWeight: 900, color: '#fbbf24', height: 28, lineHeight: '28px' }}>{unitLabel(unit.key)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#d6d3d1', flexShrink: 0, position: 'relative', lineHeight: '18px' }}>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>NARXLAR RO'YXATI</div>
          <div>{dateLabel()} holatiga</div>
        </div>
      </div>

      {/* Qisqa ma'lumot */}
      <div style={{ background: '#fffbeb', borderBottom: '2px solid #fbbf24', padding: '0 34px', height: 38, lineHeight: '38px', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#78350f' }}>
        <span>✓ Omborda bor: {totals.models} xil model · {totals.pieces} dona</span>
        <span>Sifat kafolati · Tez yetkazib berish</span>
      </div>

      {/* Jadval */}
      <div style={{ flex: 1, padding: '14px 34px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, background: '#1c1917', color: '#fbbf24', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', borderRadius: '10px 10px 0 0', padding: '0 12px', height: 36, lineHeight: '36px' }}>
          <span>№</span><span>Model</span><span style={{ textAlign: 'center' }}>Qoldiq</span>
          {showWholesale && <span style={{ textAlign: 'right' }}>Optom</span>}
          <span style={{ textAlign: 'right' }}>Chakana</span>
        </div>
        {rows.map((row, i) =>
          row.kind === 'group' ? (
            showSections || row.continued ? (
              <div key={`g${i}`} style={{ padding: '0 12px', height: 30, lineHeight: '30px', fontSize: 13, fontWeight: 900, color: '#0c0a09', background: '#fef3c7', borderLeft: '5px solid #f59e0b', borderBottom: '1px solid #fde68a' }}>
                {row.brand}<span style={{ fontWeight: 700, color: '#92400e', fontSize: 11, marginLeft: 8 }}>{row.continued ? 'davomi' : `${row.count} xil model`}</span>
              </div>
            ) : null
          ) : (
            <div key={row.item.id} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'start', padding: '0 12px', height: 34, lineHeight: '34px', fontSize: 13.5, background: row.index % 2 ? '#ffffff' : '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
              <span style={{ color: '#a8a29e', fontWeight: 700, fontSize: 12 }}>{row.index}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', paddingRight: 8, height: 34, lineHeight: '34px' }}>{row.item.name}</span>
              <span style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', minWidth: 46, height: 22, lineHeight: '12px', padding: '0 8px 2px', borderRadius: 11, fontSize: 12, fontWeight: 900, background: stockBadge(row.item.stock).bg, color: stockBadge(row.item.stock).fg }}>{row.item.stock} ta</span>
              </span>
              {showWholesale && <span style={{ textAlign: 'right', fontWeight: 800, color: '#57534e' }}>{row.item.wholesale ? formatMoney(row.item.wholesale, row.item.currency) : '—'}</span>}
              <span style={{ textAlign: 'right', fontWeight: 900, fontSize: 14.5 }}>{formatMoney(row.item.retail, row.item.currency)}</span>
            </div>
          )
        )}
      </div>

      {/* Pastki qism */}
      <div style={{ background: '#0c0a09', color: '#fff', padding: '14px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 12.5 }}>
        <div style={{ lineHeight: '20px' }}>
          <div style={{ fontWeight: 900, color: '#fbbf24', fontSize: 14 }}>📞 {contacts.phones.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).join('  ·  ')}</div>
          <div style={{ color: '#d6d3d1' }}>📍 {contacts.address}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, lineHeight: '20px' }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{contacts.link}</div>
          <div style={{ color: '#a8a29e' }}>{page} / {total}</div>
        </div>
      </div>
    </div>
  );
};

/** Kanal uchun kategoriya va brend bo'yicha reklama PDF (har brendga alohida fayl). */
export const PromoCatalogModal: React.FC<Props> = ({ products, categories, onClose }) => {
  const usedCategories = useMemo(() => {
    const set = new Set(products.filter((p) => p.stock > 0).map((p) => p.category));
    const ordered = categories.filter((c) => set.has(c));
    set.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }, [products, categories]);

  const [category, setCategory] = useState(usedCategories[0] || '');
  const [groupBy, setGroupBy] = useState<PromoGroupBy>(() => promoGroupMode(products, usedCategories[0] || ''));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showWholesale, setShowWholesale] = useState(isAccessoryCategory(usedCategories[0] || ''));
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [results, setResults] = useState<Result[]>([]);
  const [previewKey, setPreviewKey] = useState('');
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ixtiyoriy */ }
  }, [settings]);

  const keys = useMemo(() => promoKeys(products, category, groupBy), [products, category, groupBy]);
  const units = useMemo(
    () => buildPromoUnits(products, { category, by: groupBy, keys: selectedKeys, inStockOnly: true }),
    [products, category, groupBy, selectedKeys]
  );
  const pagesByUnit = useMemo(() => units.map((u) => ({ unit: u, pages: paginatePromo(u.sections, ROWS_PER_PAGE) })), [units]);
  const preview = pagesByUnit.find((b) => b.unit.key === previewKey) || pagesByUnit[0];

  const changeCategory = (c: string) => {
    setCategory(c);
    setGroupBy(promoGroupMode(products, c));
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

  const captionFor = (u: PromoUnit) => {
    const base = promoCaption(category, [], u.sections, settings, new Date(), groupBy === 'type' ? `${unitLabel(u.key)} ekranlar` : unitLabel(u.key));
    return settings.extra.trim() ? `${base}\n\n${settings.extra.trim()}`.slice(0, 1000) : base;
  };
  const fileNameFor = (key: string) =>
    `${settings.title} - ${category} ${unitLabel(key)} - ${dateLabel().replace(/\./g, '-')}.pdf`.replace(/[\\/:*?"<>|]/g, ' ');

  /** Har brend sahifalarini rasmga, keyin PDF'ga aylantiradi. */
  const buildPdfs = async (): Promise<{ key: string; pdf: Blob; cover: Blob; pages: number; models: number }[]> => {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const root = captureRef.current;
    if (!root) throw new Error('Sahifalar tayyor emas');
    const out: { key: string; pdf: Blob; cover: Blob; pages: number; models: number }[] = [];
    for (const { unit, pages } of pagesByUnit) {
      setBusy(`${unitLabel(unit.key)}: PDF tayyorlanmoqda…`);
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      let cover: Blob | null = null;
      for (let i = 0; i < pages.length; i++) {
        const el = root.querySelector<HTMLElement>(`[data-promo="${CSS.escape(unit.key)}-${i}"]`);
        if (!el) throw new Error(`Sahifa topilmadi: ${unit.key} ${i + 1}`);
        const canvas = await html2canvas(el, {
          scale: 2, backgroundColor: '#ffffff', logging: false, width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W,
          // Sahifa faqat ichki (inline) uslublardan foydalanadi. Ilova CSS'idagi oklch ranglarni html2canvas tushunmaydi,
          // shuning uchun nusxadagi umumiy uslublar olib tashlanadi va oddiy box-sizing qo'yiladi.
          onclone: (doc) => {
            doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => n.remove());
            const base = doc.createElement('style');
            base.textContent = '*,*::before,*::after{box-sizing:border-box;margin:0;border:0 solid #e7e5e4}body{margin:0}';
            doc.head.appendChild(base);
          }
        });
        const jpeg = canvas.toDataURL('image/jpeg', 0.9);
        if (i > 0) doc.addPage();
        doc.addImage(jpeg, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        if (i === 0) cover = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      }
      out.push({ key: unit.key, pdf: doc.output('blob'), cover: cover!, pages: pages.length, models: promoTotals(unit.sections).models });
    }
    return out;
  };

  const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const run = async (mode: 'download' | 'send') => {
    if (!units.length || busy) return;
    if (mode === 'send' && !window.confirm(`${units.length} ta post (${units.map((u) => unitLabel(u.key)).join(', ')}) ${settings.channel} kanaliga yuborilsinmi?`)) return;
    setResults([]);
    try {
      const built = await buildPdfs();
      const next: Result[] = built.map((b) => ({ key: b.key, pages: b.pages, models: b.models, status: 'tayyor', pdf: b.pdf, fileName: fileNameFor(b.key) }));
      setResults([...next]);
      if (mode === 'download') {
        if (built.length === 1) download(built[0].pdf, next[0].fileName);
        return;
      }
      for (let i = 0; i < built.length; i++) {
        const b = built[i];
        const unit = units.find((u) => u.key === b.key)!;
        setBusy(`${unitLabel(b.key)}: kanalga yuborilmoqda… (${i + 1}/${built.length})`);
        try {
          const response = await fetch('/api/v1/promo/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: settings.channel.trim(),
              caption: captionFor(unit),
              fileName: next[i].fileName,
              pdfBase64: await toBase64(b.pdf),
              coverBase64: await toBase64(b.cover)
            })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body.success === false) throw new Error(body.error || `Server xatosi (${response.status})`);
          next[i] = { ...next[i], status: 'yuborildi' };
        } catch (error) {
          next[i] = { ...next[i], status: 'xato', error: error instanceof Error ? error.message : 'Yuborilmadi' };
          setResults([...next]);
          if (/admin|token|Kanal manzili/i.test(next[i].error || '')) break; // sozlama xatosi — qolganlarini ham yubormaymiz
        }
        setResults([...next]);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'PDF tayyorlanmadi');
    } finally {
      setBusy('');
    }
  };

  const contacts: PromoContacts = settings;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 bg-stone-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center"><Megaphone className="w-5 h-5 text-stone-950" /></div>
            <div>
              <h3 className="font-black text-sm">Kanal uchun reklama PDF</h3>
              <div className="text-[11px] text-stone-400">Kategoriya va ekran turi bo'yicha · faqat omborda borlari · har turga alohida post</div>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white cursor-pointer" aria-label="Yopish"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Boshqaruv */}
          <div className="lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200 p-4 space-y-4 overflow-y-auto text-xs">
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
                  {(['type', 'brand'] as const).map((by) => (
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
              <div className="font-black text-stone-800">{units.length} ta PDF · {units.reduce((s, u) => s + promoTotals(u.sections).models, 0)} xil model</div>
              <div className="text-stone-500">{units.map((u) => `${unitLabel(u.key)} (${promoTotals(u.sections).models})`).join(', ') || '—'}</div>
            </div>

            <label className="block">
              <span className="font-bold text-stone-700">Postga qo'shimcha matn (ixtiyoriy)</span>
              <textarea value={settings.extra} onChange={(e) => setSettings({ ...settings, extra: e.target.value })} rows={2}
                placeholder="Masalan: Ustalarga maxsus chegirma!" className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-xl" />
            </label>

            <button type="button" onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1.5 font-bold text-stone-600 hover:text-stone-900 cursor-pointer">
              <Settings2 className="w-4 h-4" /> Do'kon ma'lumotlari va kanal
            </button>
            {showSettings && (
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

            <div className="space-y-2 pt-1">
              <button type="button" disabled={!units.length || !!busy} onClick={() => run('send')}
                className="w-full py-3 rounded-xl bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-amber-400 font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Send className="w-4 h-4" /> Kanalga yuborish ({units.length})
              </button>
              <button type="button" disabled={!units.length || !!busy} onClick={() => run('download')}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-stone-950 font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Download className="w-4 h-4" /> PDF tayyorlash / yuklab olish
              </button>
              {busy && <div className="flex items-center gap-2 font-bold text-stone-600"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</div>}
            </div>

            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div key={r.key} className={`rounded-xl border px-3 py-2 ${r.status === 'xato' ? 'border-red-200 bg-red-50' : r.status === 'yuborildi' ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black flex items-center gap-1.5">
                        {r.status === 'yuborildi' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : r.status === 'xato' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : null}
                        {unitLabel(r.key)} · {r.pages} sahifa
                      </span>
                      {r.pdf && <button onClick={() => download(r.pdf!, r.fileName)} className="text-amber-700 font-bold cursor-pointer">Yuklab olish</button>}
                    </div>
                    {r.status === 'yuborildi' && <div className="text-emerald-700 font-semibold">Kanalga yuborildi</div>}
                    {r.error && <div className="text-red-700 font-semibold">{r.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oldindan ko'rish */}
          <div className="flex-1 min-w-0 bg-stone-200/70 overflow-auto p-4">
            {pagesByUnit.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {pagesByUnit.map(({ unit }) => (
                  <button key={unit.key} onClick={() => setPreviewKey(unit.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${preview?.unit.key === unit.key ? 'bg-stone-950 text-amber-400' : 'bg-white text-stone-700'}`}>
                    {unitLabel(unit.key)}
                  </button>
                ))}
              </div>
            )}
            {!preview && (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 gap-2">
                <Smartphone className="w-10 h-10" /> Tanlangan kategoriyada omborda tovar yo'q
              </div>
            )}
            {preview && (
              <div className="space-y-4">
                {preview.pages.map((rows, i) => (
                  <div key={i} className="mx-auto shadow-xl" style={{ width: PAGE_W * 0.62, height: PAGE_H * 0.62, overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left' }}>
                      <PromoPage rows={rows} page={i + 1} total={preview.pages.length} category={category} unit={preview.unit} showWholesale={showWholesale} contacts={contacts} />
                    </div>
                  </div>
                ))}
                <div className="mx-auto max-w-[492px] bg-white rounded-2xl p-3 text-[11px] whitespace-pre-wrap text-stone-700 shadow">
                  <div className="font-black text-stone-500 mb-1">Post matni:</div>
                  {captionFor(preview.unit)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rasmga olish uchun yashirin, masshtabsiz nusxa */}
        <div ref={captureRef} aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
          {pagesByUnit.map(({ unit, pages }) =>
            pages.map((rows, i) => (
              <div key={`${unit.key}-${i}`} data-promo={`${unit.key}-${i}`} style={{ width: PAGE_W, height: PAGE_H }}>
                <PromoPage rows={rows} page={i + 1} total={pages.length} category={category} unit={unit} showWholesale={showWholesale} contacts={contacts} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
