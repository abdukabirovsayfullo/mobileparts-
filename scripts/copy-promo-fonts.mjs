// Reklama rasmlari uchun shriftlarni dist/promo-fonts ga nusxalaydi (server shu yerdan o'qiydi).
import fs from 'node:fs';
import path from 'node:path';

const src = path.join('node_modules', '@fontsource', 'inter', 'files');
const out = path.join('dist', 'promo-fonts');
fs.mkdirSync(out, { recursive: true });
for (const subset of ['latin', 'latin-ext', 'cyrillic']) {
  for (const weight of [400, 700, 900]) {
    const name = `inter-${subset}-${weight}-normal.woff`;
    fs.copyFileSync(path.join(src, name), path.join(out, name));
  }
}
console.log(`Reklama shriftlari: ${out}`);
