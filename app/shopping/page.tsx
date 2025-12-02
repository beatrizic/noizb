"use client";

import { useEffect, useState } from "react";
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

      const { data, error: insertError } = await supabase
        .from("shopping_items")
        .insert({
          couple_id: coupleId,
          label,
          done: false,
          urgent: false,
          category: null,
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
        prev.map((i) =>
          i.id === id ? { ...i, done: newDone } : i
        )
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
        {/* Header con indietro */}
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

        {/* Form aggiunta elemento */}
        <form
          onSubmit={handleAddItem}
          className="flex gap-2 rounded-2xl border border-white/5 bg-slate-900/60 p-2"
        >
          <input
            type="text"
            placeholder={
              coupleId
                ? "Es. Detersivo, pane, regalo..."
                : "Prima collega una coppia nella pagina Profilo..."
            }
            className="flex-1 rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            disabled={!coupleId || adding}
          />
          <button
            type="submit"
            disabled={adding || !coupleId}
            className="rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
          >
            {adding ? "Aggiungo..." : "Aggiungi"}
          </button>
        </form>

        {loading && (
          <p className="text-sm text-slate-300">Caricamento lista...</p>
        )}
        {info && !error && (
          <p className="text-xs text-slate-300">{info}</p>
        )}
        {error && (
          <p className="text-xs text-pink-300">{error}</p>
        )}

        {/* Lista elementi */}
        <div className="space-y-2">
          {items.map((item) => (
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

          {!loading && coupleId && items.length === 0 && (
            <p className="text-xs text-slate-400">
              Nessun elemento in lista. Inizia aggiungendo qualcosa da comprare.
            </p>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
