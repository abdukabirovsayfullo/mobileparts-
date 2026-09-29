import React, { useState, useMemo } from 'react';
import { Product, OrderItem } from '../types';
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  Package, 
  Layers, 
  X,
  Truck,
  RotateCcw
} from 'lucide-react';

interface OrderBuilderPanelProps {
  orderItems: OrderItem[];
  allProducts: Product[];
  categories: string[];
  supplierTarget: string;
  onUpdateSupplierTarget: (target: string) => void;
  onUpdateOrderItem: (item: OrderItem) => void;
  onDeleteOrderItem: (id: string) => void;
  onAddCustomOrderItem: (item: OrderItem) => void;
  onAddFromWarehouseProduct: (product: Product, quantity?: number) => void;
  onBatchAdjustQuantity: (delta: number) => void;
  onSetMinQuantity: (minQty: number) => void;
  onToggleSelectAll: (select: boolean) => void;
  onSelectZeroStockOnly: () => void;
  onResetToOutStock: () => void;
}

export const OrderBuilderPanel: React.FC<OrderBuilderPanelProps> = ({
  orderItems,
  allProducts,
  categories,
  supplierTarget,
  onUpdateSupplierTarget,
  onUpdateOrderItem,
  onDeleteOrderItem,
  onAddCustomOrderItem,
  onAddFromWarehouseProduct,
  onBatchAdjustQuantity,
  onSetMinQuantity,
  onToggleSelectAll,
  onSelectZeroStockOnly,
  onResetToOutStock
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWarehousePickerOpen, setIsWarehousePickerOpen] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState('');

  // Form state for creating custom order item (Strictly no prices)
  const [newModelName, setNewModelName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] || 'Chexol');
  const [newQuantity, setNewQuantity] = useState<number>(20);
  const [newNotes, setNewNotes] = useState('');

  // Filtered order items
  const filteredOrderItems = useMemo(() => {
    return orderItems.filter((item) => {
      const matchesCategory = selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        item.model.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [orderItems, selectedCategoryFilter, searchQuery]);

  // Summary of selected items
  const selectedItems = useMemo(() => {
    return orderItems.filter((item) => item.selected);
  }, [orderItems]);

  const totalSelectedUnits = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [selectedItems]);

  const zeroStockCount = useMemo(() => {
    return orderItems.filter((item) => item.currentStock === 0).length;
  }, [orderItems]);

  // Warehouse picker filtered products
  const warehouseFilteredProducts = useMemo(() => {
    if (!warehouseSearch.trim()) return allProducts.slice(0, 30);
    const q = warehouseSearch.toLowerCase().trim();
    return allProducts.filter((p) => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    ).slice(0, 30);
  }, [allProducts, warehouseSearch]);

  const handleCreateCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const newItem: OrderItem = {
      id: `custom_order_${Date.now()}`,
      name: newModelName.trim(),
      model: newModelName.trim(),
      category: newCategory,
      quantity: Math.max(1, Number(newQuantity) || 10),
      unit: 'dona',
      purchasePrice: 0,
      currentStock: 0,
      selected: true,
      notes: newNotes.trim(),
      isCustom: true
    };

    onAddCustomOrderItem(newItem);
    setNewModelName('');
    setNewNotes('');
    setNewQuantity(20);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-4 no-print">
      {/* Top Banner: Stats & Actions */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                Zakaz Berish Paneli (Ta'minotchi Uchun)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-stone-950">
                {selectedItems.length} xil tanlangan ({totalSelectedUnits} dona)
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Faqat tovar modeli, soni va izohlari. Narxlar ta'minotchi uchun ko'rsatilmaydi.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Ro'yxatga yangi tovar yoki model qo'shish"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Yangi Model Qo'shish</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWarehousePickerOpen(true)}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Ombordagi boshqa tovarlarni zakazga qo'shish"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Ombordan Qo'shish</span>
          </button>

          <button
            type="button"
            onClick={onResetToOutStock}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white border border-stone-700 rounded-xl text-xs transition-colors cursor-pointer"
            title="Qayta tiklash (Ombordan kam qolgan tovarlarni qayta yuklash)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Supplier & Quick Steppers */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Supplier Input */}
        <div>
          <label className="text-[11px] font-bold text-stone-400 block mb-1">
            Ta'minotchi / Diler Nomi:
          </label>
          <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 px-3 py-2 rounded-xl">
            <Truck className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={supplierTarget}
              onChange={(e) => onUpdateSupplierTarget(e.target.value)}
              placeholder="Masalan: Abu Saxiy Dileri, Malika..."
              className="bg-transparent text-white text-xs font-semibold focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Quick Batch Quantity Steppers */}
        <div className="md:col-span-2 flex flex-col justify-between">
          <label className="text-[11px] font-bold text-stone-400 block mb-1">
            Tezkor Ommaviy Soni Boshqaruv (Tanlangan tovarlar uchun):
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBatchAdjustQuantity(5)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              title="Barcha tanlangan tovarlarga +5 donadan qo'shish"
            >
              +5 dona
            </button>
            <button
              type="button"
              onClick={() => onBatchAdjustQuantity(10)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              title="Barcha tanlangan tovarlarga +10 donadan qo'shish"
            >
              +10 dona
            </button>
            <button
              type="button"
              onClick={() => onBatchAdjustQuantity(20)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              title="Barcha tanlangan tovarlarga +20 donadan qo'shish"
            >
              +20 dona
            </button>
            <button
              type="button"
              onClick={() => onSetMinQuantity(20)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              title="Har birini kamida 20 donaga yetkazish"
            >
              Min 20 dona
            </button>
            <button
              type="button"
              onClick={onSelectZeroStockOnly}
              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold cursor-pointer ml-auto"
              title="Faqat butunlay tugagan (0 dona qolgan) tovarlarni tanlash"
            >
              Faqat 0 qolganlar ({zeroStockCount})
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl w-60 sm:w-72">
            <Search className="w-3.5 h-3.5 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Model yoki tovar nomini qidirish..."
              className="bg-transparent text-white text-xs placeholder-stone-500 focus:outline-none w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-stone-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-amber-300 font-bold text-xs px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer"
          >
            <option value="all">📁 Barcha toifalar ({orderItems.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Selection toggles */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleSelectAll(true)}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Hammasini tanlash</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSelectAll(false)}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 text-stone-500" />
            <span>Bekor qilish</span>
          </button>
        </div>
      </div>

      {/* Interactive Order Items Table (Strictly NO prices) */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-md">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-stone-950 text-stone-400 sticky top-0 z-10 border-b border-stone-800 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={orderItems.length > 0 && orderItems.every((i) => i.selected)}
                    onChange={(e) => onToggleSelectAll(e.target.checked)}
                    className="rounded text-amber-400 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">Tovar Nomi & Modeli (Tahrirlash)</th>
                <th className="p-3">Toifa</th>
                <th className="p-3 text-center">Ombordagi Qoldiq</th>
                <th className="p-3 text-center">Zakaz Soni (Dona)</th>
                <th className="p-3">Qo'shimcha Izoh (Rang/Talab)</th>
                <th className="p-3 text-center w-12">O'chirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredOrderItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-500">
                    Zakaz uchun tovarlar topilmadi. Yuqoridagi "+ Yangi Model Qo'shish" tugmasini bosing.
                  </td>
                </tr>
              ) : (
                filteredOrderItems.map((item) => {
                  const isZero = item.currentStock === 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-stone-800/40 transition-colors ${
                        !item.selected ? 'opacity-40 bg-stone-950/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => onUpdateOrderItem({ ...item, selected: e.target.checked })}
                          className="rounded text-amber-400 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Model & Name - INLINE EDITABLE INPUT */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={item.model}
                            onChange={(e) => onUpdateOrderItem({ ...item, model: e.target.value, name: e.target.value })}
                            className="bg-stone-950/80 border border-stone-700/80 hover:border-amber-400/80 focus:border-amber-400 px-2.5 py-1.5 rounded-lg text-white font-bold text-xs w-full focus:outline-none"
                            placeholder="Model yoki tovar nomi..."
                          />
                          {item.isCustom && (
                            <span className="inline-block text-[9px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/30">
                              Yangi qo'shilgan model
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category - INLINE EDITABLE SELECT */}
                      <td className="p-3">
                        <select
                          value={item.category}
                          onChange={(e) => onUpdateOrderItem({ ...item, category: e.target.value })}
                          className="bg-stone-950 border border-stone-700 px-2.5 py-1.5 rounded-lg text-stone-300 text-[11px] focus:outline-none cursor-pointer w-full"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="Boshqa">Boshqa</option>
                        </select>
                      </td>

                      {/* Warehouse Stock Badge */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                            isZero
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isZero ? '0 dona (Tugagan)' : `${item.currentStock} dona qoldi`}
                        </span>
                      </td>

                      {/* Quantity Stepper & Number Input */}
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onUpdateOrderItem({ ...item, quantity: Math.max(1, item.quantity - 5) })}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center justify-center text-[10px] cursor-pointer"
                            title="-5 dona"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateOrderItem({ ...item, quantity: Math.max(1, item.quantity - 1) })}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                            title="-1 dona"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => onUpdateOrderItem({ ...item, quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-16 text-center bg-stone-950 border border-amber-400/60 font-black text-amber-400 text-xs py-1 rounded-lg focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateOrderItem({ ...item, quantity: item.quantity + 1 })}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                            title="+1 dona"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateOrderItem({ ...item, quantity: item.quantity + 5 })}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center justify-center text-[10px] cursor-pointer"
                            title="+5 dona"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateOrderItem({ ...item, quantity: item.quantity + 10 })}
                            className="w-7 h-6 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold flex items-center justify-center text-[10px] cursor-pointer"
                            title="+10 dona"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      {/* Notes / Special Request */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => onUpdateOrderItem({ ...item, notes: e.target.value })}
                          placeholder="Rang, tur yoki izoh..."
                          className="bg-stone-950 border border-stone-800 px-2.5 py-1.5 rounded-lg text-stone-300 text-xs w-full focus:outline-none focus:border-stone-600"
                        />
                      </td>

                      {/* Delete */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteOrderItem(item.id)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Zakazdan o'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar (Clear and pure: Counts & Units only) */}
        <div className="bg-stone-950 p-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-stone-400">
              Jami pozitsiyalar: <strong className="text-white">{orderItems.length} xil</strong>
            </span>
            <span className="text-stone-400">
              Tanlangan: <strong className="text-amber-400">{selectedItems.length} xil</strong>
            </span>
            <span className="text-stone-400">
              Umumiy buyurtma: <strong className="text-emerald-400 text-sm">{totalSelectedUnits} dona</strong>
            </span>
          </div>

          <div className="text-xs text-stone-400 font-medium">
            ✅ Ta'minotchi uchun narxlar berkitilgan
          </div>
        </div>
      </div>

      {/* Modal 1: Add Custom Order Item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Yangi Model / Tovar Zakazga Qo'shish</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomItem} className="space-y-3.5 text-xs">
              <div>
                <label className="text-stone-300 font-bold block mb-1">
                  Tovar Nomi va Modeli:
                </label>
                <input
                  type="text"
                  required
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="Masalan: iPhone 16 Pro Max Privacy Shisha..."
                  className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-white font-bold focus:outline-none focus:border-amber-400 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-300 font-bold block mb-1">
                    Kategoriya:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-stone-200 focus:outline-none focus:border-amber-400"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Boshqa">Boshqa</option>
                  </select>
                </div>

                <div>
                  <label className="text-stone-300 font-bold block mb-1">
                    Buyurtma Soni (dona):
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-amber-400 font-black focus:outline-none focus:border-amber-400 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-stone-300 font-bold block mb-1">
                  Izoh yoki talab (Ranglar, turlari):
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Masalan: 10 ta qora, 10 ta shaffof..."
                  className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-stone-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl cursor-pointer shadow-xs"
                >
                  + Zakazga Qo'shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add From Warehouse Catalog */}
      {isWarehousePickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>Ombordagi Tovarlardan Zakazga Qo'shish</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Mavjud katalogdagi istalgan tovarni buyurtma varaqasiga kiriting
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWarehousePickerOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warehouse Search */}
            <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl">
              <Search className="w-4 h-4 text-stone-400" />
              <input
                type="text"
                autoFocus
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                placeholder="Ombordagi tovar nomi, model yoki shtrix-kod..."
                className="bg-transparent text-white text-xs w-full focus:outline-none"
              />
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px]">
              {warehouseFilteredProducts.map((p) => {
                const alreadyInOrder = orderItems.some((i) => i.id === p.id);

                return (
                  <div
                    key={p.id}
                    className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-center justify-between gap-3 hover:border-amber-400/50 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{p.name}</div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                        <span className="text-amber-400">{p.category}</span>
                        <span>•</span>
                        <span>Qoldiq: <strong>{p.stock} dona</strong></span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={alreadyInOrder}
                      onClick={() => {
                        onAddFromWarehouseProduct(p, 20);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        alreadyInOrder
                          ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                          : 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-xs'
                      }`}
                    >
                      {alreadyInOrder ? 'Qo\'shilgan' : '+ Zakazga Qo\'shish'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-stone-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWarehousePickerOpen(false)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
