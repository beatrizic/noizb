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

type CategorySummary = {
  name: string;
  count: number;
};

type ShoppingOverview = {
  totalOpen: number;
  categories: CategorySummary[];
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
  const [shoppingOverview, setShoppingOverview] = useState<ShoppingOverview | null>(null);

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

        // 6) Riepilogo lista acquisti: categorie + conteggio (solo item non completati)
        const { data: shoppingRows, error: shoppingError } = await supabase
          .from("shopping_items")
          .select("id, label, done, category")
          .eq("couple_id", foundCoupleId)
          .eq("done", false);

        if (shoppingError && shoppingError.code !== "PGRST116") {
          throw shoppingError;
        }

        if (!cancelled && shoppingRows) {
          const categoryMap = new Map<string, number>();

          for (const row of shoppingRows) {
            const raw = (row.category as string | null) ?? "";
            const trimmed = raw.trim();
            const label = trimmed === "" ? "Senza categoria" : trimmed;
            const current = categoryMap.get(label) ?? 0;
            categoryMap.set(label, current + 1);
          }

          const categories: CategorySummary[] = Array.from(categoryMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name, "it"));

          setShoppingOverview({
            totalOpen: shoppingRows.length,
            categories,
          });
        } else if (!cancelled) {
          setShoppingOverview({
            totalOpen: 0,
            categories: [],
          });
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
                {greetingName}!
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

        {/* BLOCCO: Lista acquisti (overview per categorie) */}
        <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Cose da comprare
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
              Carico le liste...
            </p>
          )}

          {!loading && !coupleId && (
            <p className="text-xs text-slate-400">
              Collega prima una coppia per usare la lista condivisa.
            </p>
          )}

          {!loading && coupleId && shoppingOverview && (
            <>
              {shoppingOverview.totalOpen === 0 ? (
                <p className="text-xs text-slate-400">
                  Nessun elemento da comprare. 🎉
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-300">
                    Hai{" "}
                    <span className="font-semibold text-slate-50">
                      {shoppingOverview.totalOpen}
                    </span>{" "}
                    elementi da comprare.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {shoppingOverview.categories.map((cat) => (
                      <div
                        key={cat.name}
                        className="flex items-center gap-1 rounded-full bg-slate-900/90 px-3 py-1"
                      >
                        <span className="text-xs text-slate-50">
                          {cat.name}
                        </span>
                        <span className="text-[10px] font-semibold text-pink-300">
                          · {cat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Bottom nav gestita altrove */}
      </div>
    </ProtectedPage>
  );
}
