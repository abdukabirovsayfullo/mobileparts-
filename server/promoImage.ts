import fs from 'fs';
import path from 'path';
import satoriModule from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { formatMoney } from '../src/utils/formatters';
import { OTHER_TYPE, PromoContacts, PromoRow, PromoUnit, paginatePromo, promoTotals } from '../src/utils/promoCatalog';

/** Telegram uchun tik (4:5) rasm: telefonda to'liq ekranni egallaydi, siqilganda ham o'qiladi. */
export const PROMO_W = 1080;
export const PROMO_H = 1350;
/** Bir rasmdagi qatorlar (brend sarlavhasi ham qator). Kam qator — katta yozuv. */
export const PROMO_ROWS_PER_IMAGE = 11;
/** Tovar kam bo'lsa rasm qisqaradi, lekin kvadratdan kichik bo'lmaydi. */
const PROMO_MIN_H = 1080;

// CJS yig'mada (dist/server.cjs) default import butun modul bo'lib keladi — ikkala holatni qo'llab-quvvatlaymiz.
const satori: typeof satoriModule = typeof satoriModule === 'function' ? satoriModule : (satoriModule as any).default;

type Font = { name: string; data: Buffer; weight: 400 | 700 | 900; style: 'normal' };
const FONT_NAMES: Record<string, string> = { latin: 'Inter', 'latin-ext': 'InterExt', cyrillic: 'InterCyr' };
/** Shrift papkasi: ishchi papka yoki server fayli (dist/server.cjs, server.ts) yonidagi node_modules. */
const fontDir = () => {
  const roots = [process.cwd(), typeof __dirname !== 'undefined' ? path.join(__dirname, '..') : '', process.argv[1] ? path.join(path.dirname(process.argv[1]), '..') : '', process.argv[1] ? path.dirname(process.argv[1]) : ''];
  for (const root of roots.filter(Boolean)) {
    const dir = path.join(root, 'node_modules', '@fontsource', 'inter', 'files');
    if (fs.existsSync(dir)) return dir + path.sep;
  }
  throw new Error("Reklama shrifti topilmadi (@fontsource/inter o'rnatilmagan).");
};
let fontsCache: Font[] | null = null;
const loadFonts = (): Font[] => {
  if (fontsCache) return fontsCache;
  const dir = fontDir();
  const fonts: Font[] = [];
  for (const subset of ['latin', 'latin-ext', 'cyrillic']) {
    for (const weight of [400, 700, 900] as const) {
      fonts.push({ name: FONT_NAMES[subset], weight, style: 'normal', data: fs.readFileSync(`${dir}inter-${subset}-${weight}-normal.woff`) });
    }
  }
  fontsCache = fonts;
  return fonts;
};

type Node = { type: string; props: Record<string, any> };
const h = (style: Record<string, any>, ...children: (Node | string | null | false | undefined)[]): Node => {
  const list = children.filter((c) => c !== null && c !== false && c !== undefined);
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: list.length === 1 ? list[0] : list } };
};

const unitLabel = (key: string) => (key === OTHER_TYPE ? 'Boshqa' : key);
const dateLabel = (date: Date) => date.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });

const stockColors = (n: number) =>
  n >= 5 ? { bg: '#dcfce7', fg: '#166534', border: '#86efac' } : n > 0 ? { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d' } : { bg: '#e7e5e4', fg: '#57534e', border: '#d6d3d1' };

export interface PromoImageOptions {
  category: string;
  unit: PromoUnit;
  showWholesale: boolean;
  contacts: PromoContacts;
  date?: Date;
}

const ROW_H = 80;

function pageTree(rows: PromoRow[], page: number, total: number, opts: PromoImageOptions, height = PROMO_H): Node {
  const { category, unit, showWholesale, contacts } = opts;
  const totals = promoTotals(unit.sections);
  const showSections = unit.sections.length > 1;
  const stockW = showWholesale ? 130 : 160;
  const priceW = showWholesale ? 215 : 250;
  const phones = contacts.phones.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  const header = h(
    { background: '#0c0a09', color: '#fff', padding: '40px 48px 34px', alignItems: 'center', gap: 26, position: 'relative', overflow: 'hidden' },
    h({ position: 'absolute', right: -90, top: -120, width: 320, height: 320, borderRadius: 160, background: '#1c1917' }),
    h(
      { width: 96, height: 96, borderRadius: 24, background: '#fbbf24', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
      {
        type: 'svg',
        props: {
          width: 54, height: 54, viewBox: '0 0 24 24', fill: 'none', stroke: '#0c0a09', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          children: [
            { type: 'rect', props: { x: 6, y: 2, width: 12, height: 20, rx: 2.5 } },
            { type: 'path', props: { d: 'M11 18h2' } },
            { type: 'circle', props: { cx: 12, cy: 10, r: 2.6 } }
          ]
        }
      }
    ),
    h(
      { flexDirection: 'column', flex: 1, minWidth: 0 },
      h({ fontSize: 42, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1 }, contacts.title),
      h(
        { marginTop: 14, alignItems: 'center', gap: 16 },
        h({ background: '#fbbf24', color: '#0c0a09', fontWeight: 900, fontSize: 24, padding: '6px 16px', borderRadius: 12, textTransform: 'uppercase' }, category),
        h({ fontSize: 40, fontWeight: 900, color: '#fbbf24' }, unitLabel(unit.key))
      )
    ),
    h(
      { flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, fontSize: 20, color: '#d6d3d1' },
      h({ fontWeight: 900, color: '#fff', fontSize: 22 }, "NARXLAR"),
      h({}, `${dateLabel(opts.date || new Date())}`)
    )
  );

  const strip = h(
    { background: '#fffbeb', borderBottom: '4px solid #fbbf24', padding: '0 48px', height: 70, alignItems: 'center', justifyContent: 'space-between', fontSize: 26, fontWeight: 900, color: '#78350f' },
    h({}, `Omborda bor: ${totals.models} xil model`),
    h({ background: '#78350f', color: '#fffbeb', padding: '4px 16px', borderRadius: 12 }, `${totals.pieces} dona`)
  );

  const tableHead = h(
    { background: '#1c1917', color: '#fbbf24', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', borderRadius: '16px 16px 0 0', padding: '0 20px', height: 54, alignItems: 'center' },
    h({ flex: 1 }, 'Model'),
    h({ width: stockW, justifyContent: 'center' }, 'Omborda'),
    showWholesale ? h({ width: priceW, justifyContent: 'flex-end' }, 'Optom') : null,
    h({ width: priceW, justifyContent: 'flex-end' }, 'Narxi')
  );

  const body = rows.map((row, i) => {
    if (row.kind === 'group') {
      if (!showSections && !row.continued) return null;
      return h(
        { height: ROW_H - 18, alignItems: 'center', padding: '0 20px', fontSize: 26, fontWeight: 900, color: '#0c0a09', background: '#fef3c7', borderLeft: '8px solid #f59e0b', borderBottom: '1px solid #fde68a', gap: 14 },
        row.brand,
        h({ fontSize: 20, fontWeight: 700, color: '#92400e' }, row.continued ? 'davomi' : `${row.count} xil model`)
      );
    }
    const c = stockColors(row.item.stock);
    return h(
      { height: ROW_H, alignItems: 'center', padding: '0 20px', background: i % 2 ? '#ffffff' : '#fafaf9', borderBottom: '2px solid #e7e5e4' },
      h(
        { flex: 1, minWidth: 0, alignItems: 'center', gap: 14, paddingRight: 12 },
        h({ fontSize: 20, fontWeight: 700, color: '#a8a29e', width: 40, flexShrink: 0 }, String(row.index)),
        h({ display: 'block', fontSize: showWholesale ? 27 : 30, fontWeight: 900, color: '#1c1917', lineHeight: 1.15, overflow: 'hidden', lineClamp: 2, flex: 1 }, row.item.name)
      ),
      h(
        { width: stockW, justifyContent: 'center' },
        h({ background: c.bg, color: c.fg, border: `2px solid ${c.border}`, fontSize: showWholesale ? 23 : 26, fontWeight: 900, padding: '4px 14px', borderRadius: 30, whiteSpace: 'nowrap' }, `${row.item.stock} ta`)
      ),
      showWholesale ? h({ width: priceW, justifyContent: 'flex-end', whiteSpace: 'nowrap', fontSize: 25, fontWeight: 700, color: '#57534e' }, row.item.wholesale ? formatMoney(row.item.wholesale, row.item.currency) : '—') : null,
      h({ width: priceW, justifyContent: 'flex-end', whiteSpace: 'nowrap', fontSize: showWholesale ? 28 : 32, fontWeight: 900, color: '#0c0a09' }, formatMoney(row.item.retail, row.item.currency))
    );
  });

  const footer = h(
    { background: '#0c0a09', color: '#fff', padding: '24px 48px', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
    h(
      { flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 },
      h({ fontWeight: 900, color: '#fbbf24', fontSize: 28 }, phones.join('  ·  ')),
      h({ color: '#d6d3d1', fontSize: 21 }, contacts.address)
    ),
    h(
      { flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 6 },
      h({ fontWeight: 900, fontSize: 26 }, contacts.link),
      total > 1 ? h({ color: '#a8a29e', fontSize: 20 }, `${page} / ${total}`) : null
    )
  );

  return h(
    { width: PROMO_W, height, background: '#ffffff', fontFamily: 'Inter, InterExt, InterCyr', flexDirection: 'column', color: '#1c1917' },
    header,
    strip,
    h({ flex: 1, flexDirection: 'column', padding: '24px 40px 0' }, tableHead, ...body),
    footer
  );
}

/** Rasm sahifalari. Bitta brend bo'lsa, brend sarlavhasi ko'rinmaydi — joyini tovar egallaydi. */
export const promoImagePages = (unit: PromoUnit) =>
  paginatePromo(unit.sections, unit.sections.length > 1 ? PROMO_ROWS_PER_IMAGE : PROMO_ROWS_PER_IMAGE + 1);

/** Bitta brend/tur uchun reklama rasmlari (PNG). Sahifalar ko'p bo'lsa — bir nechta rasm. */
export async function renderPromoImages(opts: PromoImageOptions): Promise<Buffer[]> {
  const pages = promoImagePages(opts.unit);
  const fonts = loadFonts();
  const out: Buffer[] = [];
  for (let i = 0; i < pages.length; i++) {
    const height = pages.length === 1 ? Math.max(PROMO_MIN_H, Math.min(PROMO_H, PROMO_H - (PROMO_ROWS_PER_IMAGE + 1 - pages[0].length) * ROW_H)) : PROMO_H;
    const svg = await satori(pageTree(pages[i], i + 1, pages.length, opts, height) as any, { width: PROMO_W, height, fonts });
    out.push(new Resvg(svg, { fitTo: { mode: 'width', value: PROMO_W } }).render().asPng());
  }
  return out;
}
