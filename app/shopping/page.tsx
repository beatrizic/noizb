"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedPage } from "../../components/ProtectedPage";

type ShoppingItem = {
  id: string;
  label: string;
  done: boolean;
  category: string | null;
  urgent: boolean | null;
};

const FIXED_CATEGORIES = ["casa", "spesa", "viaggi", "altro"] as const;

function isFixedCategoryName(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return FIXED_CATEGORIES.some((c) => c.toLowerCase() === trimmed);
}

export default function ShoppingPage() {
  const router = useRouter();

  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // gestione categorie per aggiunta item
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [useNewCategory, setUseNewCategory] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>("");

  // mostra/nascondi elementi spuntati
  const [showDone, setShowDone] = useState<boolean>(false);

  // gestione modifica/eliminazione categorie (solo custom)
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>("");
  const [categoryActionLoading, setCategoryActionLoading] =
    useState<string | null>(null);

  // ---------------------- CARICAMENTO INIZIALE ---------------------- //

  useEffect(() => {
    let cancelled = false;

    async function loadShopping() {
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          if (!cancelled) {
            setError("Sessione non valida, effettua di nuovo l'accesso.");
          }
          return;
        }

        if (cancelled) return;

        const { data: memberRows, error: memberError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .limit(1);

        if (memberError) throw memberError;

        if (!memberRows || memberRows.length === 0) {
          if (!cancelled) {
            setCoupleId(null);
            setItems([]);
            setInfo(
              "Non risulti ancora collegata a nessuna coppia. Vai nella pagina Profilo per crearla o collegarti."
            );
          }
          return;
        }

        const foundCoupleId = memberRows[0].couple_id as string;
        if (cancelled) return;

        setCoupleId(foundCoupleId);

        const { data: shoppingRows, error: shoppingError } = await supabase
          .from("shopping_items")
          .select("id, label, done, category, urgent")
          .eq("couple_id", foundCoupleId)
          .order("created_at", { ascending: true });

        if (shoppingError) throw shoppingError;

        if (!cancelled && shoppingRows) {
          setItems(
            shoppingRows.map((row) => ({
              id: row.id as string,
              label: row.label as string,
              done: !!row.done,
              category: (row.category as string | null) ?? null,
              urgent: (row.urgent as boolean | null) ?? null,
            }))
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Errore nel caricamento della lista.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadShopping();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------- RAGGRUPPAMENTO PER CATEGORIA ---------------------- //

  const groupedItems = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();

    for (const item of items) {
      if (!showDone && item.done) {
        // non mostro gli spuntati se showDone = false
        continue;
      }

      const categoryName = item.category?.trim() || "Senza categoria";

      if (!map.has(categoryName)) {
        map.set(categoryName, []);
      }
      map.get(categoryName)!.push(item);
    }

    const sortedCategories = Array.from(map.keys()).sort((a, b) => {
      if (a === "Senza categoria") return 1;
      if (b === "Senza categoria") return -1;
      return a.localeCompare(b, "it");
    });

    return { map, sortedCategories };
  }, [items, showDone]);

  // ---------------------- AGGIUNTA ITEM ---------------------- //

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    if (!coupleId) {
      setInfo(
        "Devi prima avere una coppia collegata. Vai nella pagina Profilo."
      );
      return;
    }

    setAdding(true);
    setError(null);
    setInfo(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessione non valida, effettua di nuovo l'accesso.");
        return;
      }

      const label = newItem.trim();
      const categoryValue = useNewCategory
        ? newCategory.trim()
        : selectedCategory.trim();

      const { data, error: insertError } = await supabase
        .from("shopping_items")
        .insert({
          couple_id: coupleId,
          label,
          done: false,
          urgent: false,
          category: categoryValue || null,
          created_by: user.id,
        })
        .select("id, label, done, category, urgent")
        .single();

      if (insertError || !data) {
        throw insertError || new Error("Errore nell'aggiunta dell'elemento.");
      }

      const newRow: ShoppingItem = {
        id: data.id as string,
        label: data.label as string,
        done: !!data.done,
        category: (data.category as string | null) ?? null,
        urgent: (data.urgent as boolean | null) ?? null,
      };

      setItems((prev) => [...prev, newRow]);
      setNewItem("");

      if (useNewCategory && categoryValue) {
        setSelectedCategory(categoryValue);
        setNewCategory("");
        setUseNewCategory(false);
      }
    } catch (err: any) {
      setError(err.message ?? "Errore nell'aggiunta dell'elemento.");
    } finally {
      setAdding(false);
    }
  }

  // ---------------------- TOGGLE DONE ITEM ---------------------- //

  async function toggleItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newDone = !item.done;

    setTogglingId(id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("shopping_items")
        .update({ done: newDone })
        .eq("id", id);

      if (updateError) throw updateError;

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, done: newDone } : i))
      );
    } catch (err: any) {
      setError(err.message ?? "Errore durante l'aggiornamento dell'elemento.");
    } finally {
      setTogglingId(null);
    }
  }

  // ---------------------- MODIFICA / DELETE CATEGORIA CUSTOM ---------------------- //

  function startEditCategory(catName: string) {
    if (isFixedCategoryName(catName) || catName === "Senza categoria") return;
    setEditingCategory(catName);
    setEditingCategoryName(catName);
  }

  function cancelEditCategory() {
    setEditingCategory(null);
    setEditingCategoryName("");
  }

  async function handleRenameCategory(oldName: string) {
    if (isFixedCategoryName(oldName) || oldName === "Senza categoria") {
      cancelEditCategory();
      return;
    }

    const trimmedNew = editingCategoryName.trim();
    if (!trimmedNew || trimmedNew === oldName || !coupleId) {
      cancelEditCategory();
      return;
    }

    setError(null);
    setCategoryActionLoading(oldName);

    const prevItems = items;

    // optimistic
    setItems((prev) =>
      prev.map((item) =>
        (item.category?.trim() || "") === oldName
          ? { ...item, category: trimmedNew }
          : item
      )
    );

    try {
      const { error: updateError } = await supabase
        .from("shopping_items")
        .update({ category: trimmedNew })
        .eq("couple_id", coupleId)
        .eq("category", oldName);

      if (updateError) {
        throw updateError;
      }

      cancelEditCategory();
    } catch (err: any) {
      setError(
        err.message ??
          "Errore durante la modifica della categoria. Modifica annullata."
      );
      setItems(prevItems);
      cancelEditCategory();
    } finally {
      setCategoryActionLoading(null);
    }
  }

  async function handleDeleteCategory(catName: string) {
    if (isFixedCategoryName(catName) || catName === "Senza categoria") {
      return;
    }
    if (!coupleId) return;

    const confirmDelete = window.confirm(
      `Vuoi davvero eliminare la categoria "${catName}"?\nGli elementi resteranno in lista ma senza categoria.`
    );
    if (!confirmDelete) return;

    setError(null);
    setCategoryActionLoading(catName);

    const prevItems = items;

    // optimistic: porto gli item a "Senza categoria" (category null)
    setItems((prev) =>
      prev.map((item) =>
        (item.category?.trim() || "") === catName
          ? { ...item, category: null }
          : item
      )
    );

    try {
      const { error: updateError } = await supabase
        .from("shopping_items")
        .update({ category: null })
        .eq("couple_id", coupleId)
        .eq("category", catName);

      if (updateError) {
        throw updateError;
      }

      if (editingCategory === catName) {
        cancelEditCategory();
      }
    } catch (err: any) {
      setError(
        err.message ??
          "Errore durante l'eliminazione della categoria. Modifica annullata."
      );
      setItems(prevItems);
    } finally {
      setCategoryActionLoading(null);
    }
  }

  // ---------------------- RENDER ---------------------- //

  return (
    <ProtectedPage>
      <div className="space-y-4">
        {/* Header con indietro + titolo pagina */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            >
              ←
            </button>
            <h1 className="text-xl font-semibold text-slate-50">
              Lista acquisti
            </h1>
          </div>
        </div>

        {/* Form aggiunta elemento + scelta categoria */}
        <form
          onSubmit={handleAddItem}
          className="space-y-2 rounded-2xl border border-white/5 bg-slate-900/60 p-3"
        >
          {/* Selettore categoria / nuova categoria */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Categoria / lista
            </label>
            <div className="flex gap-2">
              {!useNewCategory && (
                <select
                  className="flex-1 rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={!coupleId || adding}
                >
                  <option value="">Senza categoria</option>
                  {FIXED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              )}

              {useNewCategory && (
                <input
                  type="text"
                  placeholder="Es. Lista regali, Casa Ikea..."
                  className="flex-1 rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  disabled={!coupleId || adding}
                />
              )}

              <button
                type="button"
                onClick={() => {
                  if (useNewCategory) {
                    setUseNewCategory(false);
                    setNewCategory("");
                  } else {
                    setUseNewCategory(true);
                  }
                }}
                className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
              >
                {useNewCategory ? "Usa lista fissa" : "Nuova lista"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Categorie fisse:{" "}
              <span className="font-semibold">casa</span>,{" "}
              <span className="font-semibold">spesa</span>,{" "}
              <span className="font-semibold">viaggi</span>,{" "}
              <span className="font-semibold">altro</span>. <br />
              Le liste personalizzate le crei con “Nuova lista” e puoi
              modificarle o eliminarle.
            </p>
          </div>

          {/* Campo testo elemento */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={
                coupleId
                  ? "Es. Pane, acqua, voli, valigia..."
                  : "Prima collega una coppia nella pagina Profilo..."
              }
              className="flex-1 rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              disabled={!coupleId || adding}
            />
            <button
              type="submit"
              disabled={adding || !coupleId || !newItem.trim()}
              className="rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
            >
              {adding ? "Aggiungo..." : "Aggiungi"}
            </button>
          </div>
        </form>

        {/* Toggle mostra/nascondi spuntati */}
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/80 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-50">
              Elementi completati
            </p>
            <p className="text-[11px] text-slate-400">
              Quando spunti qualcosa sparisce dalla lista, ma puoi rivederlo
              quando vuoi con “Mostra spuntati”.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDone((prev) => !prev)}
            className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-50 hover:bg-slate-700"
          >
            {showDone ? "Nascondi spuntati" : "Mostra spuntati"}
          </button>
        </div>

        {loading && (
          <p className="text-sm text-slate-300">Caricamento lista...</p>
        )}
        {info && !error && <p className="text-xs text-slate-300">{info}</p>}
        {error && <p className="text-xs text-pink-300">{error}</p>}

        {/* Liste per categoria con gestione categorie custom */}
        <div className="space-y-3">
          {!loading &&
            coupleId &&
            groupedItems.sortedCategories.length === 0 && (
              <p className="text-xs text-slate-400">
                Nessun elemento in lista per i filtri attuali. Aggiungi qualcosa
                o prova a mostrare gli elementi spuntati.
              </p>
            )}

          {groupedItems.sortedCategories.map((catName) => {
            const catItems = groupedItems.map.get(catName) ?? [];
            if (catItems.length === 0) return null;

            const isEditing = editingCategory === catName;
            const isBusy = categoryActionLoading === catName;
            const isFixed = isFixedCategoryName(catName);

            return (
              <div
                key={catName}
                className="space-y-1 rounded-2xl border border-white/5 bg-slate-900/70 p-2"
              >
                {/* Header categoria con azioni (solo per custom) */}
                <div className="flex items-center justify-between px-1 pb-1">
                  {!isEditing ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {catName}
                      </p>
                      {!isFixed && catName !== "Senza categoria" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                            onClick={() => startEditCategory(catName)}
                            disabled={isBusy}
                          >
                            ✎ Modifica
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-red-200 hover:bg-red-700/70"
                            onClick={() => void handleDeleteCategory(catName)}
                            disabled={isBusy}
                          >
                            🗑 Elimina
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        className="rounded-xl bg-pink-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
                        onClick={() => void handleRenameCategory(catName)}
                        disabled={isBusy}
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                        onClick={cancelEditCategory}
                        disabled={isBusy}
                      >
                        Annulla
                      </button>
                    </div>
                  )}
                </div>

                {/* Items della categoria */}
                <div className="space-y-1">
                  {catItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      disabled={togglingId === item.id}
                      className={`flex w-full items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 text-left ${
                        item.done ? "opacity-60 line-through" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm text-slate-50">{item.label}</p>
                        {item.urgent && !item.done && (
                          <p className="text-[11px] text-amber-300">Urgente</p>
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
                            "flex h-6 w-6 items-center justify-center rounded-full border text-xs " +
                            (item.done
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                              : "border-slate-500 text-slate-500")
                          }
                        >
                          {togglingId === item.id
                            ? "..."
                            : item.done
                            ? "✓"
                            : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedPage>
  );
}
