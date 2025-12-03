"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { ProtectedPage } from "../components/ProtectedPage";

type UpcomingEvent = {
  id: string;
  title: string;
  start_at: string; // timestamptz ISO
  all_day: boolean;
};

type ShoppingItem = {
  id: string;
  label: string;
  done: boolean;
  urgent: boolean | null;
  category: string | null;
};

function calculateDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ann = new Date(dateStr);
  if (Number.isNaN(ann.getTime())) return null;

  const today = new Date();

  const annMid = new Date(
    ann.getFullYear(),
    ann.getMonth(),
    ann.getDate()
  ).getTime();
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  if (todayMid < annMid) return 0;

  const diffMs = todayMid - annMid;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatEventDateTime(startAt: string, allDay: boolean): string {
  const date = new Date(startAt);

  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const monthNames = [
    "gen",
    "feb",
    "mar",
    "apr",
    "mag",
    "giu",
    "lug",
    "ago",
    "set",
    "ott",
    "nov",
    "dic",
  ];

  const dayName = dayNames[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, "0");
  const monthName = monthNames[date.getMonth()];

  if (allDay) {
    return `${dayName} ${dayNum} ${monthName} · tutto il giorno`;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${dayName} ${dayNum} ${monthName} · ${hours}:${minutes}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState<string>("");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState<string | null>(null);
  const [daysTogether, setDaysTogether] = useState<number | null>(null);

  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHome(): Promise<void> {
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        // 1) Utente loggato
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

        // 2) Nome utente dal profilo
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (!cancelled) {
          setDisplayName(profile?.display_name ?? "");
        }

        // 3) Coppia dell'utente
        const { data: memberRows, error: memberError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .limit(1);

        if (memberError) throw memberError;

        if (!memberRows || memberRows.length === 0) {
          if (!cancelled) {
            setCoupleId(null);
            setInfo(
              "Non hai ancora una coppia collegata. Vai in Profilo per crearla o collegarti."
            );
          }
          return;
        }

        const foundCoupleId = memberRows[0].couple_id as string;
        if (cancelled) return;

        setCoupleId(foundCoupleId);

        // 4) Dati coppia -> anniversary_date + name
        const { data: coupleRow, error: coupleError } = await supabase
          .from("couples")
          .select("anniversary_date, name")
          .eq("id", foundCoupleId)
          .single();

        if (coupleError) throw coupleError;

        const annDate: string | null = coupleRow?.anniversary_date ?? null;

        if (!cancelled) {
          setDaysTogether(calculateDaysSince(annDate));
          setCoupleName(coupleRow?.name ?? null);
        }

        // 5) Prossimi eventi da "calendario" (max 3, dal momento corrente in poi)
        const nowIso = new Date().toISOString();
        const { data: eventRows, error: eventsError } = await supabase
          .from("calendario")
          .select("id, title, start_at, all_day, couple_id")
          .eq("couple_id", foundCoupleId)
          .gte("start_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(3);

        if (eventsError && eventsError.code !== "PGRST116") {
          throw eventsError;
        }

        if (!cancelled && eventRows) {
          setEvents(
            eventRows.map((row) => ({
              id: row.id as string,
              title: row.title as string,
              start_at: row.start_at as string,
              all_day: Boolean(row.all_day),
            }))
          );
        }

        // 6) Lista acquisti (preview, max 5) da "shopping_items"
        const { data: shoppingRows, error: shoppingError } = await supabase
          .from("shopping_items")
          .select("id, label, done, urgent, category")
          .eq("couple_id", foundCoupleId)
          .order("created_at", { ascending: true })
          .limit(5);

        if (shoppingError && shoppingError.code !== "PGRST116") {
          throw shoppingError;
        }

        if (!cancelled && shoppingRows) {
          setShoppingItems(
            shoppingRows.map((row) => ({
              id: row.id as string,
              label: row.label as string,
              done: !!row.done,
              urgent: (row.urgent as boolean | null) ?? null,
              category: (row.category as string | null) ?? null,
            }))
          );
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Errore nel caricamento della home.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHome();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleShoppingItem(id: string): Promise<void> {
    const item = shoppingItems.find((i) => i.id === id);
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

      setShoppingItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, done: newDone } : i))
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Errore durante l'aggiornamento della lista acquisti.";
      setError(message);
    } finally {
      setTogglingId(null);
    }
  }

  const greetingName = displayName || "lì";
  const coupleLabel = coupleName ? `${coupleName}` : "@noi_due";

  return (
    <ProtectedPage>
      <div className="space-y-6">
        {/* HEADER: nome app + ciao + giorni insieme */}
        <header className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-pink-300">
            NOIZB
          </div>

          <div className="space-y-1">
            <p className="text-sm text-slate-300">
              Ciao{" "}
              <span className="font-semibold text-slate-50">
                {greetingName}
              </span>
            </p>

            {coupleId && daysTogether !== null && (
              <p className="text-sm text-slate-200">
                stiamo insieme da{" "}
                <span className="font-semibold">{daysTogether}</span> giorni!
              </p>
            )}

            {coupleId && daysTogether === null && (
              <p className="text-xs text-slate-400">
                Imposta la data di anniversario nella sezione Profilo per vedere
                i giorni insieme.
              </p>
            )}

            {!coupleId && (
              <p className="text-xs text-slate-400">
                Collega una coppia dalla sezione Profilo per vedere i giorni
                insieme e i dati condivisi.
              </p>
            )}
          </div>
        </header>

        {info && !error && (
          <p className="text-xs text-slate-400">{info}</p>
        )}
        {error && (
          <p className="text-xs text-pink-300">{error}</p>
        )}

        {/* BLOCCO: Prossimi eventi */}
        <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Prossimi eventi
            </h2>
            <button
              type="button"
              onClick={() => router.push("/calendar")}
              className="text-xs text-pink-300 hover:text-pink-200"
            >
              Vai al calendario →
            </button>
          </div>

          {loading && (
            <p className="text-xs text-slate-400">Carico gli eventi...</p>
          )}

          {!loading && coupleId && events.length === 0 && (
            <p className="text-xs text-slate-400">
              Nessun evento in programma. Aggiungili dalla pagina Calendario.
            </p>
          )}

          {!loading && !coupleId && (
            <p className="text-xs text-slate-400">
              Nessuna coppia collegata: collega un partner per usare il
              calendario di coppia.
            </p>
          )}

          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl bg-slate-900/90 px-3 py-2"
              >
                <p className="text-sm font-medium text-slate-50">
                  {event.title}
                </p>
                <p className="text-xs text-slate-400">
                  {formatEventDateTime(event.start_at, event.all_day)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCCO: Lista acquisti */}
        <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Lista acquisti
            </h2>
            <button
              type="button"
              onClick={() => router.push("/shopping")}
              className="text-xs text-sky-300 hover:text-sky-200"
            >
              Vai alla lista →
            </button>
          </div>

          {loading && (
            <p className="text-xs text-slate-400">
              Carico la lista acquisti...
            </p>
          )}

          {!loading && coupleId && shoppingItems.length === 0 && (
            <p className="text-xs text-slate-400">
              Nessun elemento in lista. Aggiungi qualcosa dalla pagina Lista
              acquisti.
            </p>
          )}

          {!loading && !coupleId && (
            <p className="text-xs text-slate-400">
              Collega prima una coppia per usare la lista condivisa.
            </p>
          )}

          <div className="space-y-2">
            {shoppingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleShoppingItem(item.id)}
                disabled={togglingId === item.id}
                className={`flex w-full items-center justify-between rounded-xl bg-slate-900/90 px-3 py-2 text-left ${
                  item.done ? "opacity-60 line-through" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-50">{item.label}</p>
                  {item.urgent && (
                    <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-300">
                      urgente
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.category && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {item.category}
                    </span>
                  )}
                  <span
                    className={
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[11px] " +
                      (item.done
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-500 text-slate-500")
                    }
                  >
                    {togglingId === item.id ? "…" : item.done ? "✓" : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bottom nav gestita altrove */}
      </div>
    </ProtectedPage>
  );
}
