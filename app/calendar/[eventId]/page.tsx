// app/calendar/[eventId]/page.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import {
  useRouter,
  useSearchParams,
  useParams,
} from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { ProtectedPage } from "../../../components/ProtectedPage";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  is_for_couple: boolean;
  created_by: string;
  couple_id: string | null;
};

type UserCoupleInfo = {
  userId: string;
  coupleId: string | null;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateTime(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const dt = new Date(year, month - 1, day, hour ?? 0, minute ?? 0);
  return dt.toISOString();
}

type NavigatorWithShare = Navigator & {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
};

export default function EventPage(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;

  const isNew = eventId === "new";

  const [userInfo, setUserInfo] = useState<UserCoupleInfo | null>(null);
  const [eventData, setEventData] = useState<CalendarEvent | null>(null);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  const [dateStart, setDateStart] = useState<string>("");
  const [timeStart, setTimeStart] = useState<string>("09:00");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [timeEnd, setTimeEnd] = useState<string>("10:00");

  const [allDay, setAllDay] = useState<boolean>(false);
  const [isForCouple, setIsForCouple] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDateFromQuery = useMemo(() => {
    const d = searchParams.get("date");
    if (!d) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return d;
  }, [searchParams]);

  const canEdit = useMemo(() => {
    if (isNew) return true;
    if (!userInfo || !eventData) return false;
    return eventData.created_by === userInfo.userId;
  }, [isNew, userInfo, eventData]);

  // Caricamento utente + coppia + evento (se esistente)
  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      if (!eventId) {
        setError("ID evento non valido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Utente
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Utente non autenticato");

        const userId = user.id as string;

        // Coppia dell'utente (se esiste)
        const { data: cmRows, error: cmError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", userId)
          .limit(1);

        if (cmError) throw cmError;

        const coupleId =
          cmRows && cmRows.length > 0
            ? (cmRows[0].couple_id as string)
            : null;

        if (!isMounted) return;

        const info: UserCoupleInfo = { userId, coupleId };
        setUserInfo(info);

        if (isNew) {
          initNewEvent(info);
        } else {
          await loadExistingEvent();
        }
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError("Errore nel caricamento dell'evento.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    function initNewEvent(info: UserCoupleInfo): void {
      const baseDate = defaultDateFromQuery
        ? new Date(defaultDateFromQuery)
        : new Date();

      const dateStr = toDateInputValue(baseDate);

      setEventData(null);
      setTitle("");
      setDescription("");
      setLocation("");
      setDateStart(dateStr);
      setDateEnd(dateStr);
      setTimeStart("09:00");
      setTimeEnd("10:00");
      setAllDay(false);
      setIsForCouple(!!info.coupleId);
      setEditing(true);
    }

    async function loadExistingEvent(): Promise<void> {
      const { data, error: eventError } = await supabase
        .from("calendario")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) {
        throw eventError;
      }

      if (!data) {
        throw new Error("Evento non trovato");
      }

      const ev: CalendarEvent = {
        id: data.id as string,
        title: data.title as string,
        description: (data.description as string | null) ?? null,
        location: (data.location as string | null) ?? null,
        start_at: data.start_at as string,
        end_at: data.end_at as string,
        all_day: (data.all_day as boolean) ?? false,
        is_for_couple: (data.is_for_couple as boolean) ?? false,
        created_by: data.created_by as string,
        couple_id: (data.couple_id as string | null) ?? null,
      };

      const start = new Date(ev.start_at);
      const end = new Date(ev.end_at);

      setEventData(ev);
      setTitle(ev.title);
      setDescription(ev.description ?? "");
      setLocation(ev.location ?? "");
      setDateStart(toDateInputValue(start));
      setDateEnd(toDateInputValue(end));
      setTimeStart(toTimeInputValue(start));
      setTimeEnd(toTimeInputValue(end));
      setAllDay(ev.all_day);
      setIsForCouple(ev.is_for_couple);
      setEditing(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isNew, defaultDateFromQuery]);

  async function handleSave(): Promise<void> {
    if (!userInfo) return;
    if (!title.trim()) {
      setError("Inserisci un titolo per l'evento.");
      return;
    }
    if (!dateStart || !dateEnd) {
      setError("Inserisci data di inizio e fine.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const coupleId = userInfo.coupleId;

      const startIso = allDay
        ? combineDateTime(dateStart, "00:00")
        : combineDateTime(dateStart, timeStart || "09:00");

      const endIso = allDay
        ? combineDateTime(dateEnd, "23:59")
        : combineDateTime(dateEnd, timeEnd || "10:00");

      if (isNew) {
        const { error: insertError } = await supabase
          .from("calendario")
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            location: location.trim() || null,
            start_at: startIso,
            end_at: endIso,
            all_day: allDay,
            is_for_couple: isForCouple && !!coupleId,
            couple_id: isForCouple && coupleId ? coupleId : null,
            created_by: userInfo.userId,
          });

        if (insertError) {
          throw insertError;
        }

        router.replace("/calendar");
      } else {
        const { error: updateError } = await supabase
          .from("calendario")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            location: location.trim() || null,
            start_at: startIso,
            end_at: endIso,
            all_day: allDay,
            is_for_couple: isForCouple && !!coupleId,
            couple_id: isForCouple && coupleId ? coupleId : null,
          })
          .eq("id", eventId);

        if (updateError) {
          throw updateError;
        }

        setEditing(false);
        router.replace("/calendar");
      }
    } catch (err) {
      console.error(err);
      setError("Errore nel salvataggio dell'evento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (isNew) {
      router.back();
      return;
    }

    if (!window.confirm("Vuoi davvero eliminare questo evento?")) return;

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("calendario")
        .delete()
        .eq("id", eventId);

      if (deleteError) {
        throw deleteError;
      }

      router.replace("/calendar");
    } catch (err) {
      console.error(err);
      setError("Errore nell'eliminazione dell'evento.");
    } finally {
      setDeleting(false);
    }
  }

  function handleStartEditing(): void {
    if (!canEdit) return;
    setEditing(true);
  }

  function handleCancel(): void {
    if (isNew) {
      router.back();
      return;
    }

    if (!eventData) {
      router.replace("/calendar");
      return;
    }

    const start = new Date(eventData.start_at);
    const end = new Date(eventData.end_at);

    setTitle(eventData.title);
    setDescription(eventData.description ?? "");
    setLocation(eventData.location ?? "");
    setDateStart(toDateInputValue(start));
    setDateEnd(toDateInputValue(end));
    setTimeStart(toTimeInputValue(start));
    setTimeEnd(toTimeInputValue(end));
    setAllDay(eventData.all_day);
    setIsForCouple(eventData.is_for_couple);
    setEditing(false);
  }

  async function handleShare(): Promise<void> {
    const baseStartIso = allDay
      ? combineDateTime(dateStart, "00:00")
      : combineDateTime(dateStart, timeStart || "09:00");
    const baseEndIso = allDay
      ? combineDateTime(dateEnd, "23:59")
      : combineDateTime(dateEnd, timeEnd || "10:00");

    const startDate = dateStart ? new Date(baseStartIso) : null;
    const endDate = dateEnd ? new Date(baseEndIso) : null;

    const when =
      allDay && startDate
        ? `Tutto il giorno - ${startDate.toLocaleDateString("it-IT")}`
        : startDate && endDate
        ? `${startDate.toLocaleString("it-IT")} – ${endDate.toLocaleString(
            "it-IT"
          )}`
        : "Quando: da definire";

    const tipo = isForCouple ? "Evento di coppia" : "Evento personale";

    const lines: string[] = [
      `📅 ${title || "Evento"}`,
      when,
      tipo,
      location ? `📍 ${location}` : "",
      description ? `📝 ${description}` : "",
    ].filter(Boolean);

    const text = lines.join("\n");

    try {
      const nav = navigator as NavigatorWithShare;

      if (nav.share) {
        await nav.share({
          title: title || "Evento",
          text,
        });
      } else if (nav.clipboard && nav.clipboard.writeText) {
        await nav.clipboard.writeText(text);
        alert("Dettagli evento copiati negli appunti.");
      } else {
        alert(text);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const headerTitle = isNew ? "Nuovo evento" : "Dettaglio evento";

  const labelCreatoDa = useMemo(() => {
    if (isNew) return "";
    if (!eventData || !userInfo) return "";
    return eventData.created_by === userInfo.userId
      ? "Creato da te"
      : "Creato dal partner";
  }, [isNew, eventData, userInfo]);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-6">
        {/* Header stile iOS / app resto */}
        <header className="px-4 pt-6 pb-4 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs font-medium text-slate-400"
          >
            Indietro
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              noizb
            </span>
            <h1 className="text-sm font-semibold mt-1">{headerTitle}</h1>
          </div>
          {editing ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded-full disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          ) : canEdit ? (
            <button
              type="button"
              onClick={handleStartEditing}
              className="text-xs font-semibold text-slate-100 px-3 py-1 rounded-full border border-slate-600"
            >
              Modifica
            </button>
          ) : (
            <span className="text-[10px] text-slate-500">Solo lettura</span>
          )}
        </header>

        {error && (
          <p className="px-4 pt-2 text-xs text-red-400">{error}</p>
        )}

        {loading ? (
          <p className="px-4 pt-4 text-sm text-slate-400">Caricamento...</p>
        ) : (
          <form className="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
            {/* Titolo */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Titolo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!editing}
                placeholder="Es. Cena, visita, appuntamento..."
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                  editing
                    ? "bg-slate-900 border-slate-700"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              />
            </div>

            {/* Quando */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 px-3 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Tutto il giorno
                </span>
                <button
                  type="button"
                  onClick={() => editing && setAllDay((v) => !v)}
                  disabled={!editing}
                  className={`w-11 h-6 rounded-full flex items-center px-[3px] transition ${
                    allDay ? "bg-emerald-500" : "bg-slate-700"
                  } ${!editing ? "opacity-60" : ""}`}
                >
                  <span
                    className={`w-4 h-4 bg-slate-50 rounded-full shadow transform transition ${
                      allDay ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Data/ora inizio */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">Inizio</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    disabled={!editing}
                    className={`text-xs rounded-2xl border px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                      editing
                        ? "bg-slate-950 border-slate-700"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      disabled={!editing}
                      className={`text-xs rounded-2xl border px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                        editing
                          ? "bg-slate-950 border-slate-700"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    />
                  )}
                </div>
              </div>

              {/* Data/ora fine */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">Fine</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    disabled={!editing}
                    className={`text-xs rounded-2xl border px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                      editing
                        ? "bg-slate-950 border-slate-700"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  />
                  {!allDay && (
                    <input
                      type="time"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                      disabled={!editing}
                      className={`text-xs rounded-2xl border px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                        editing
                          ? "bg-slate-950 border-slate-700"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Luogo */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Luogo</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!editing}
                placeholder="Aggiungi luogo"
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                  editing
                    ? "bg-slate-900 border-slate-700"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              />
            </div>

            {/* Tipo evento / persone */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 px-3 py-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 mb-0.5">Persone</p>
                <p className="text-sm text-slate-50">
                  {isForCouple ? "Evento di coppia" : "Solo per te"}
                </p>
                {labelCreatoDa && (
                  <p className="text-[10px] text-slate-500">
                    {labelCreatoDa}
                  </p>
                )}
              </div>
              {userInfo?.coupleId ? (
                <button
                  type="button"
                  onClick={() => editing && setIsForCouple((prev) => !prev)}
                  disabled={!editing}
                  className={`text-[11px] px-3 py-1 rounded-full border ${
                    isForCouple
                      ? "border-pink-400 text-pink-300 bg-pink-500/10"
                      : "border-slate-600 text-slate-200 bg-slate-800/60"
                  } ${!editing ? "opacity-60" : ""}`}
                >
                  {isForCouple ? "Coppia" : "Personale"}
                </button>
              ) : (
                <span className="text-[10px] text-slate-500">
                  Non sei in una coppia: evento personale
                </span>
              )}
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Note</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!editing}
                rows={4}
                placeholder="Aggiungi note all'evento"
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60 resize-none ${
                  editing
                    ? "bg-slate-900 border-slate-700"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              />
            </div>

            {/* Azioni */}
            <div className="pt-2 space-y-2 pb-4">
              {editing && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  Annulla modifiche
                </button>
              )}

              {!isNew && canEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full rounded-2xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-300 disabled:opacity-60"
                >
                  {deleting ? "Eliminazione..." : "Elimina evento"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  void handleShare();
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                Condividi evento
              </button>
            </div>
          </form>
        )}
      </div>
    </ProtectedPage>
  );
}
