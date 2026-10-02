import React, { useState } from 'react';
import { Product, StockMovement, DebtRecord, SupplierDebtRecord, StoreSettings } from '../types';
import { formatMoney } from '../utils/formatters';
import { 
  Building2, 
  Settings, 
  Save, 
  Check, 
  TrendingUp, 
  Calculator, 
  Percent, 
  Package, 
  DollarSign, 
  Search, 
  Edit3, 
  ArrowUpDown, 
  Sparkles, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface HisobchiPanelViewProps {
  products: Product[];
  movements: StockMovement[];
  debts: DebtRecord[];
  supplierDebts: SupplierDebtRecord[];
  storeInfo: StoreSettings;
  onUpdateStoreInfo: (info: StoreSettings) => void;
  onBatchUpdatePrices: (
    category: string,
    percentChange: number,
    target: 'sellingPrice' | 'wholesalePrice'
  ) => void;
  onUpdateSingleProductPrices: (
    productId: string,
    costPrice: number,
    wholesalePrice: number,
    sellingPrice: number
  ) => void;
}

export const HisobchiPanelView: React.FC<HisobchiPanelViewProps> = ({
  products,
  movements,
  debts,
  supplierDebts,
  storeInfo,
  onUpdateStoreInfo,
  onBatchUpdatePrices,
  onUpdateSingleProductPrices
}) => {
  // Store info form state
  const [formData, setFormData] = useState<StoreSettings>({
    name: storeInfo.name || 'MOBILE PARTS',
    tagline: storeInfo.tagline || 'Telefon ehtiyot qismlari va aksessuarlar markazi',
    address: storeInfo.address || "Z. Habibiy ko'chasi, Yoqubov stoyankasi to'g'risida, Beeline ofisi",
    phone: storeInfo.phone || '+998 95 200 13 33, +998 91 174 13 33',
    phone2: storeInfo.phone2 || '+998 91 174 13 33',
    accountantName: storeInfo.accountantName || 'Sayfullo (Hisobchi / Kassir)',
    workingHours: storeInfo.workingHours || '08:00 - 20:00'
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Batch price update states
  const [batchCategory, setBatchCategory] = useState<string>('all');
  const [batchPercent, setBatchPercent] = useState<number>(5);
  const [batchTarget, setBatchTarget] = useState<'sellingPrice' | 'wholesalePrice'>('sellingPrice');
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // Search & filter products for inline price editing table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<number>(0);
  const [editWholesale, setEditWholesale] = useState<number>(0);
  const [editSelling, setEditSelling] = useState<number>(0);

  const categories = Array.from(new Set(products.map((p) => p.category)));

  // Financial totals
  const totalStockQuantity = products.reduce((sum, p) => sum + p.stock, 0);
  const totalCostValue = products.reduce((sum, p) => sum + (p.purchasePrice || p.costPrice || 0) * p.stock, 0);
  const totalWholesaleValue = products.reduce((sum, p) => sum + (p.wholesalePrice || p.sellingPrice) * p.stock, 0);
  const totalRetailValue = products.reduce((sum, p) => sum + p.sellingPrice * p.stock, 0);
  
  const totalCustomerDebt = debts
    .filter((d) => d.status !== 'yopildi')
    .reduce((sum, d) => sum + d.remainingAmount, 0);

  const totalSupplierDebt = supplierDebts
    .filter((d) => d.status !== 'yopildi')
    .reduce((sum, d) => sum + d.remainingAmount, 0);

  const netEnterpriseBalance = totalCostValue + totalCustomerDebt - totalSupplierDebt;

  // Handle Save Store Info
  const handleSaveStoreInfo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreInfo(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Handle Execute Batch Update
  const handleRunBatch = () => {
    if (batchPercent === 0) return;
    const confirmed = confirm(
      `Haqiqatan ham ${batchCategory === 'all' ? 'barcha' : batchCategory} tovarlarning ${
        batchTarget === 'sellingPrice' ? 'Chakana' : 'Optom'
      } narxini ${batchPercent > 0 ? '+' : ''}${batchPercent}% ga o'zgartirmoqchimisiz?`
    );
    if (!confirmed) return;

    onBatchUpdatePrices(batchCategory, batchPercent, batchTarget);
    setBatchSuccessMsg(`Narxlar muvaffaqiyatli ${batchPercent > 0 ? '+' : ''}${batchPercent}% ga yangilandi!`);
    setTimeout(() => setBatchSuccessMsg(null), 4000);
  };

  // Start editing single row
  const handleStartEditRow = (p: Product) => {
    setEditingRowId(p.id);
    setEditCost(p.purchasePrice || p.costPrice || 0);
    setEditWholesale(p.wholesalePrice || Math.round(p.sellingPrice * 0.8));
    setEditSelling(p.sellingPrice);
  };

  // Save single row
  const handleSaveRow = (productId: string) => {
    onUpdateSingleProductPrices(productId, editCost, editWholesale, editSelling);
    setEditingRowId(null);
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 border border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-xs font-black tracking-wider uppercase">
              Boshqaruv
            </span>
            <span className="text-xs text-stone-400">Buxgalteriya & Kassa Sozlamalari</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1 text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-amber-400" />
            <span>Hisobchi Paneli & Do'kon Sozlamalari</span>
          </h1>
          <p className="text-sm text-stone-300 mt-1 max-w-2xl">
            Do'kon nomi, manzili, chekdagi ma'lumotlar, tovarlarning kirim (tan), optom va chakana narxlarini to'g'ridan-to'g'ri shu yerdan boshqaring.
          </p>
        </div>

        <div className="bg-stone-950/80 p-3 rounded-xl border border-stone-800 text-right shrink-0">
          <div className="text-[11px] text-stone-400 uppercase tracking-wider font-semibold">Korxona Sof Qoldig'i</div>
          <div className="text-lg font-black text-amber-400 mt-0.5">
            {formatMoney(netEnterpriseBalance)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            (Tan narxdagi tovar + Mijozlar qarzi - Bizning qarzimiz)
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span>Tan narxidagi ombor</span>
            <Package className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-lg font-black text-stone-900">{formatMoney(totalCostValue)}</div>
          <div className="text-[11px] text-stone-500 mt-1">{totalStockQuantity} dona tovar mavjud</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 text-xs mb-1">
            <span>Optom (Ulgurji) qiymati</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-600">{formatMoney(totalWholesaleValue)}</div>
          <div className="text-[11px] text-stone-500 mt-1">Ulgurji narxdagi tushum</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs mb-1">
            <span>Chakana qiymati</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-600">{formatMoney(totalRetailValue)}</div>
          <div className="text-[11px] text-stone-500 mt-1">Kutilayotgan tushum</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 text-xs mb-1">
            <span>Mijozlar Nasiyasi</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-black text-rose-600">{formatMoney(totalCustomerDebt)}</div>
          <div className="text-[11px] text-stone-500 mt-1">Mijozlarimizdan kelishi kerak</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Store Settings & Chek Rekvizitlari */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-stone-900 text-base">Do'kon & Chek Rekvizitlari</h2>
            </div>
            {savedSuccess && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saqlandi!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveStoreInfo} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Do'kon Nomi (Chekda katta chiqadi):
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 font-bold text-stone-950"
                placeholder="Masalan: MOBILE PARTS"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Tavsifi / Shiori:
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 text-stone-800"
                placeholder="Telefon ehtiyot qismlari va aksessuarlar"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Manzil (Mo'ljal):
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 text-stone-800"
                placeholder="Z. Habibiy ko'chasi, Yoqubov stoyankasi to'g'risida, Beeline ofisi"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Telefon Raqamlari (Chekda va hisobotda):
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 font-medium text-stone-900"
                placeholder="+998 95 200 13 33, +998 91 174 13 33"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Mas'ul Hisobchi / Kassir Ismi:
              </label>
              <input
                type="text"
                value={formData.accountantName}
                onChange={(e) => setFormData({ ...formData, accountantName: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 text-stone-800"
                placeholder="Sayfullo"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">
                Ish Vaqti:
              </label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-400 text-stone-800"
                placeholder="08:00 - 20:00"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Save className="w-4 h-4" />
              <span>Rekvizitlarni Saqlash</span>
            </button>
          </form>

          {/* Quick preview of receipt header */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center font-mono text-[11px] space-y-0.5">
            <div className="font-black text-xs text-stone-900">{formData.name}</div>
            <div className="text-stone-500 text-[10px]">{formData.address}</div>
            <div className="text-stone-700 font-bold text-[10px]">{formData.phone}</div>
          </div>
        </div>

        {/* Right Columns (2 spans): Bulk Pricing & Product Price Matrix */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bulk Price Adjustment Card */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-stone-900 text-base">Ommaviy Narx O'zgartirish (Kalkulyator)</h2>
              </div>
              <span className="text-xs text-stone-500">Tezkor qayta baholash</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-stone-600 font-bold mb-1">Kategoriya:</label>
                <select
                  value={batchCategory}
                  onChange={(e) => setBatchCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-medium"
                >
                  <option value="all">Barcha tovarlar</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-600 font-bold mb-1">Qaysi narx o'zgaradi:</label>
                <select
                  value={batchTarget}
                  onChange={(e) => setBatchTarget(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold text-amber-700"
                >
                  <option value="sellingPrice">Chakana Sotuv Narxi</option>
                  <option value="wholesalePrice">Optom (Ulgurji) Narxi</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600 font-bold mb-1">Foiz o'zgarishi (+ yoki -):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={batchPercent}
                    onChange={(e) => setBatchPercent(Number(e.target.value))}
                    step="1"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-black text-stone-950 text-center"
                    placeholder="Masalan: 5 yoki -5"
                  />
                  <span className="font-bold text-stone-600">%</span>
                </div>
              </div>
            </div>

            {/* Fast preset buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500 font-medium">Tezkor tugmalar:</span>
              {[-10, -5, 5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBatchPercent(pct)}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                    batchPercent === pct
                      ? 'bg-amber-400 border-amber-500 text-stone-950'
                      : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              {batchSuccessMsg ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> {batchSuccessMsg}
                </span>
              ) : (
                <span className="text-[11px] text-stone-500">
                  * Hisoblangan yangi narxlar eng yaqin 500 so'mgacha yaxlitlanadi
                </span>
              )}

              <button
                type="button"
                onClick={handleRunBatch}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-black rounded-xl text-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Qayta baholashni qo'llash</span>
              </button>
            </div>
          </div>

          {/* Product Price Matrix Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                  <span>Tovarlar Narx Matritsasi (Tan, Optom, Chakana)</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Har bir tovar narxini alohida-alohida o'zgartirib saqlashingiz mumkin.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Qidiruv..."
                    className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium"
                >
                  <option value="all">Barchasi</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[460px] border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-stone-100 text-stone-700 font-bold border-b border-stone-200 z-10">
                  <tr>
                    <th className="p-3">Tovar Nomi</th>
                    <th className="p-3 text-center">Qoldiq</th>
                    <th className="p-3 text-right">Tan Narxi (Kirim)</th>
                    <th className="p-3 text-right bg-amber-50/50">Optom Narxi</th>
                    <th className="p-3 text-right bg-emerald-50/50">Chakana Narxi</th>
                    <th className="p-3 text-center">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredProducts.map((p) => {
                    const isEditing = editingRowId === p.id;
                    const cost = p.purchasePrice || p.costPrice || 0;
                    const wholesale = p.wholesalePrice || Math.round(p.sellingPrice * 0.8);
                    const retail = p.sellingPrice;

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-stone-900">{p.name}</div>
                          <div className="text-[10px] text-stone-400">{p.category} • Shtrix: {p.barcode || '-'}</div>
                        </td>

                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 font-bold text-[11px]">
                            {p.stock} dona
                          </span>
                        </td>

                        {/* Tan narxi */}
                        <td className="p-3 text-right font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(Number(e.target.value))}
                              step="500"
                              className="w-24 px-2 py-1 border border-stone-300 rounded text-right font-bold text-stone-950"
                            />
                          ) : (
                            <span className="text-stone-600 font-semibold">{formatMoney(cost)}</span>
                          )}
                        </td>

                        {/* Optom narxi */}
                        <td className="p-3 text-right font-mono bg-amber-50/30">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editWholesale}
                              onChange={(e) => setEditWholesale(Number(e.target.value))}
                              step="500"
                              className="w-24 px-2 py-1 border border-amber-300 bg-amber-50 rounded text-right font-black text-amber-900"
                            />
                          ) : (
                            <span className="font-bold text-amber-700">{formatMoney(wholesale)}</span>
                          )}
                        </td>

                        {/* Chakana narxi */}
                        <td className="p-3 text-right font-mono bg-emerald-50/30">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editSelling}
                              onChange={(e) => setEditSelling(Number(e.target.value))}
                              step="500"
                              className="w-24 px-2 py-1 border border-emerald-300 bg-emerald-50 rounded text-right font-black text-emerald-900"
                            />
                          ) : (
                            <span className="font-bold text-emerald-700">{formatMoney(retail)}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveRow(p.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Saqlash
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRowId(null)}
                                className="px-1.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-[11px] cursor-pointer"
                              >
                                Bekor
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEditRow(p)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3 text-stone-500" />
                              <span>Tahrirlash</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
