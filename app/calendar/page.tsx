"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedPage } from "../../components/ProtectedPage";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  type: string | null;
};

export default function CalendarPage() {
  const router = useRouter();

  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
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
            setEvents([]);
            setInfo(
              "Non risulti ancora collegata a nessuna coppia. Vai nella pagina Profilo per crearla o collegarti."
            );
          }
          return;
        }

        const foundCoupleId = memberRows[0].couple_id as string;
        if (cancelled) return;

        setCoupleId(foundCoupleId);

        const { data: eventRows, error: eventsError } = await supabase
          .from("events")
          .select("id, title, event_date, event_time, type")
          .eq("couple_id", foundCoupleId)
          .order("event_date", { ascending: true });

        if (eventsError) throw eventsError;

        if (!cancelled && eventRows) {
          setEvents(
            eventRows.map((row) => ({
              id: row.id as string,
              title: row.title as string,
              event_date: row.event_date as string,
              event_time: (row.event_time as string | null) ?? null,
              type: (row.type as string | null) ?? null,
            }))
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Errore nel caricamento del calendario.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!coupleId) {
      setInfo(
        "Devi prima avere una coppia collegata. Vai nella pagina Profilo."
      );
      return;
    }
    if (!newTitle.trim() || !newDate) return;

    setCreating(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          couple_id: coupleId,
          title: newTitle.trim(),
          event_date: newDate,
          event_time: newTime ? `${newTime}:00+00` : null,
          type: "coppia",
        })
        .select("id, title, event_date, event_time, type")
        .single();

      if (insertError || !data) {
        throw insertError || new Error("Errore nella creazione dell'evento.");
      }

      const newEvent: EventRow = {
        id: data.id as string,
        title: data.title as string,
        event_date: data.event_date as string,
        event_time: (data.event_time as string | null) ?? null,
        type: (data.type as string | null) ?? null,
      };

      setEvents((prev) =>
        [...prev, newEvent].sort((a, b) =>
          a.event_date.localeCompare(b.event_date)
        )
      );
      setNewTitle("");
      setNewDate("");
      setNewTime("");
    } catch (err: any) {
      setError(err.message ?? "Errore nella creazione dell'evento.");
    } finally {
      setCreating(false);
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
            Calendario di coppia
          </h1>
        </div>

        {/* Nuovo evento */}
        <form
          onSubmit={handleAddEvent}
          className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4"
        >
          <p className="text-xs font-medium text-slate-200">
            Aggiungi un evento
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder='Es. "Cena da Francesca e Luca"'
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1 rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-28 rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !coupleId}
            className="w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
          >
            {creating ? "Creo..." : "Aggiungi evento"}
          </button>
        </form>

        {loading && (
          <p className="text-sm text-slate-300">Caricamento eventi...</p>
        )}
        {info && !error && (
          <p className="text-xs text-slate-300">{info}</p>
        )}
        {error && (
          <p className="text-xs text-pink-300">{error}</p>
        )}

        {/* Lista eventi */}
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between rounded-xl bg-slate-900/80 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-50">
                  {event.title}
                </p>
                <p className="text-xs text-slate-400">
                  {event.event_date}
                  {event.event_time ? ` · ${event.event_time}` : ""}
                </p>
              </div>
              {event.type && (
                <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-300">
                  {event.type}
                </span>
              )}
            </div>
          ))}

          {!loading && coupleId && events.length === 0 && (
            <p className="text-xs text-slate-400">
              Nessun evento ancora. Aggiungine uno sopra.
            </p>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
