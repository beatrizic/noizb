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

  // gestione categorie
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [useNewCategory, setUseNewCategory] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>("");

  // mostra/nascondi elementi spuntati
  const [showDone, setShowDone] = useState<boolean>(false);

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

  // categorie disponibili, derivate dagli item
  const categories = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const item of items) {
      const cat = item.category?.trim();
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [items]);

  // items raggruppati per categoria, con filtro "mostra spuntati"
  const groupedItems = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();

    for (const item of items) {
      if (!showDone && item.done) {
        // se non devo mostrare i completati li salto
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

      // decido la categoria da associare al nuovo elemento
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

      // se ho usato una nuova categoria, la imposto come selezionata e disattivo il campo
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
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}

              {useNewCategory && (
                <input
                  type="text"
                  placeholder="Es. Lista spesa, Lista viaggi..."
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
                {useNewCategory ? "Usa elenco" : "Nuova lista"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Esempi: <span className="font-semibold">Lista spesa</span>,{" "}
              <span className="font-semibold">Lista viaggi</span>,{" "}
              <span className="font-semibold">Casa Ikea</span>…
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
              quando vuoi.
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
        {info && !error && (
          <p className="text-xs text-slate-300">{info}</p>
        )}
        {error && <p className="text-xs text-pink-300">{error}</p>}

        {/* Liste per categoria */}
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

            return (
              <div
                key={catName}
                className="space-y-1 rounded-2xl border border-white/5 bg-slate-900/70 p-2"
              >
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {catName}
                </p>
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
                        <p className="text-sm text-slate-50">
                          {item.label}
                        </p>
                        {item.urgent && !item.done && (
                          <p className="text-[11px] text-amber-300">
                            Urgente
                          </p>
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
