"use client";

import { useState } from "react";

type ShoppingItem = {
  id: number;
  label: string;
  done: boolean;
  category?: string;
  urgent?: boolean;
};

const initialItems: ShoppingItem[] = [
  { id: 1, label: "Carta igienica", done: false, category: "Casa", urgent: true },
  { id: 2, label: "Regalo Leo", done: false, category: "Regali", urgent: true },
  { id: 3, label: "Caffè", done: true, category: "Spesa", urgent: false },
];

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [newItem, setNewItem] = useState("");

  function toggleItem(id: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems((prev) => [
      ...prev,
      { id: nextId, label: newItem.trim(), done: false },
    ]);
    setNewItem("");
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Lista acquisti</h1>
        <p className="text-sm text-slate-400">
          Aggiungi qualcosa tu o lui, e contrassegna come acquistato.
        </p>
      </header>

      {/* Form aggiunta elemento */}
      <form
        onSubmit={addItem}
        className="flex gap-2 rounded-2xl border border-white/5 bg-slate-900/60 p-2"
      >
        <input
          type="text"
          placeholder="Es. Detersivo, pane, regalo..."
          className="flex-1 rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400"
        >
          Aggiungi
        </button>
      </form>

      {/* Lista */}
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleItem(item.id)}
            className={`flex w-full items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 text-left ${
              item.done ? "opacity-60 line-through" : ""
            }`}
          >
            <div>
              <p className="text-sm text-slate-50">{item.label}</p>
              {item.category && (
                <p className="text-[11px] text-slate-400">{item.category}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.urgent && !item.done && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Urgente
                </span>
              )}
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full border " +
                  (item.done
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-500 text-slate-500")
                }
              >
                {item.done ? "✓" : ""}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
