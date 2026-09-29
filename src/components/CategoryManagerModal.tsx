import React, { useState } from 'react';
import { Product } from '../types';
import { FolderPlus, Edit3, Trash2, Check, X, Tag, AlertCircle } from 'lucide-react';

interface CategoryManagerModalProps {
  categories: string[];
  products: Product[];
  onAddCategory: (categoryName: string) => boolean; // returns true if added
  onEditCategory: (oldName: string, newName: string) => boolean;
  onDeleteCategory: (categoryName: string) => boolean;
  onClose: () => void;
  onSelectCategory?: (categoryName: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  categories,
  products,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onClose,
  onSelectCategory
}) => {
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getProductCount = (category: string) => {
    return products.filter((p) => p.category === category).length;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newCatInput.trim();
    if (!trimmed) return;

    const success = onAddCategory(trimmed);
    if (success) {
      setNewCatInput('');
      if (onSelectCategory) {
        onSelectCategory(trimmed);
      }
    } else {
      setErrorMsg(`"${trimmed}" nomli katalog allaqachon mavjud!`);
    }
  };

  const startEdit = (cat: string) => {
    setEditingCat(cat);
    setEditedName(cat);
    setErrorMsg(null);
  };

  const handleSaveEdit = (oldCat: string) => {
    setErrorMsg(null);
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === oldCat) {
      setEditingCat(null);
      return;
    }

    const success = onEditCategory(oldCat, trimmed);
    if (success) {
      setEditingCat(null);
      if (onSelectCategory) {
        onSelectCategory(trimmed);
      }
    } else {
      setErrorMsg(`"${trimmed}" nomli katalog allaqachon mavjud!`);
    }
  };

  const handleDelete = (cat: string) => {
    setErrorMsg(null);
    const count = getProductCount(cat);
    if (count > 0) {
      if (!confirm(`"${cat}" katalogida ${count} ta tovar mavjud. Baribir o'chirmoqchimisiz? (Tovarlar boshqa toifaga o'tkaziladi)`)) {
        return;
      }
    } else {
      if (!confirm(`"${cat}" katalogini o'chirmoqchimisiz?`)) {
        return;
      }
    }

    onDeleteCategory(cat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-black">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Kataloglar &amp; Kategoriyalarni Boshqarish</h3>
              <p className="text-[11px] text-stone-400">Yangi toifa qo'shish yoki mavjudlarini tahrirlash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Add New Category Form */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              Yangi Katalog / Kategoriya Qo'shish:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Masalan: Smart Soatlar, Xotira Kartalari, O'yin Aksessuarlari..."
                className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
              />
              <button
                type="submit"
                disabled={!newCatInput.trim()}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ Qo'shish</span>
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-500">
              <span>Mavjud Kataloglar ({categories.length} ta):</span>
              <span className="text-[11px] font-normal text-stone-400">Tovarlar soni</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100">
              {categories.length === 0 ? (
                <div className="text-center py-6 text-stone-400 text-xs">
                  Kataloglar ro'yxati bo'sh
                </div>
              ) : (
                categories.map((cat) => {
                  const count = getProductCount(cat);
                  const isEditing = editingCat === cat;

                  return (
                    <div
                      key={cat}
                      className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 group hover:bg-stone-50 p-2 rounded-xl transition-colors"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(cat);
                              if (e.key === 'Escape') setEditingCat(null);
                            }}
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 bg-white border-2 border-amber-400 rounded-lg text-xs font-bold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                            title="Saqlash"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCat(null)}
                            className="p-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Bekor qilish"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {cat}
                            </span>
                            <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                              {count} ta tovar
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onSelectCategory && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCategory(cat);
                                  onClose();
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Tanlash
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                              title="Nomini tahrirlash"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span>💡 Katalog tahrirlansa, unga tegishli barcha tovarlar avtomatik yangilanadi.</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
