import type { Product } from '../types';

const cyrillicMap: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',қ:'q',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ў:'o',ф:'f',х:'x',ҳ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya'
};

export const normalizeSearchText = (value: unknown): string => String(value ?? '')
  .toLocaleLowerCase('uz')
  .replace(/[а-яёғқўҳ]/g, letter => cyrillicMap[letter] ?? letter)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`ʻʼʹ']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim().replace(/\s+/g, ' ');

const withinOneEdit = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){ if(a[i]===b[j]){i++;j++;continue;} if(++edits>1)return false; if(a.length>b.length)i++; else if(b.length>a.length)j++; else{i++;j++;} }
  return edits + (i<a.length||j<b.length?1:0) <= 1;
};

export const productSearchScore = (product: Product, query: string): number => {
  const q=normalizeSearchText(query); if(!q)return 1;
  const barcode=normalizeSearchText(product.barcode); const id=normalizeSearchText(product.id);
  const name=normalizeSearchText(product.name); const brand=normalizeSearchText(product.brand); const category=normalizeSearchText(product.category);
  if(q===barcode||q===id)return 10000;
  if(barcode.startsWith(q)||id.startsWith(q))return 8500;
  if(name===q)return 7500;
  if(name.startsWith(q))return 6500;
  const haystack=`${name} ${brand} ${category} ${barcode} ${id}`; const words=haystack.split(' '); const tokens=q.split(' ');
  let score=0;
  for(const token of tokens){
    if(!token)continue;
    if(words.includes(token))score+=900;
    else if(words.some(word=>word.startsWith(token)))score+=650;
    else if(haystack.includes(token))score+=450;
    else if(words.some(word=>withinOneEdit(token,word)))score+=250;
    else return 0;
  }
  if(product.stock>0)score+=40;
  return score;
};

export const searchProducts = (products: Product[], query: string): Product[] => {
  if(!normalizeSearchText(query))return products;
  return products.map((product,index)=>({product,index,score:productSearchScore(product,query)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||Number(b.product.stock>0)-Number(a.product.stock>0)||a.index-b.index).map(row=>row.product);
};

export const exactProductCodeMatch = (products: Product[], query: string): Product | undefined => {
  const q=normalizeSearchText(query); if(!q)return undefined;
  const matches=products.filter(product=>normalizeSearchText(product.barcode)===q||normalizeSearchText(product.id)===q);
  return matches.length===1?matches[0]:undefined;
};
