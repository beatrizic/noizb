// app/calendar/page.tsx
"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  type ReactElement,
  type FormEvent,
} from "react";
import { createClient } from "@supabase/supabase-js";

type EventScope = "personal" | "couple";

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO "YYYY-MM-DD"
  time?: string; // "HH:MM"
  createdByProfileId: string;
  scope: EventScope;
}

type EventFilter = "all" | "me" | "partner" | "couple";
type NewEventOwner = "me" | "partner" | "couple";
type EventSheetMode = "create" | "edit";

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
}

interface CalendarEventRow {
  id: string;
  title: string;
  date: string;
  time: string | null;
  scope: EventScope;
  created_by_profile_id: string;
  couple_id: string | null;
}

interface ProfileRow {
  id: string;
  couple_id: string | null;
}

interface CoupleMemberRow {
  profile_id: string;
  couple_id: string;
}

// ENV Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars mancanti: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const weekdayLabels = ["L", "M", "M", "G", "V", "S", "D"];

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

// Settimana che parte da lunedì
function generateCalendarMatrix(viewDate: Date): CalendarDay[][] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  // Giorni del mese precedente
  if (firstWeekday > 0) {
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      days.push({
        date: new Date(year, month - 1, day),
        inCurrentMonth: false,
      });
    }
  }

  // Giorni del mese corrente
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: new Date(year, month, day),
      inCurrentMonth: true,
    });
  }

  // Giorni successivi per completare 6x7
  const totalCells = 6 * 7;
  const remaining = totalCells - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      inCurrentMonth: false,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < totalCells; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return weeks;
}

function mapRowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time ?? undefined,
    createdByProfileId: row.created_by_profile_id,
    scope: row.scope,
  };
}

function getEventCategory(
  event: CalendarEvent,
  currentUserId?: string | null,
  partnerProfileId?: string | null
): EventFilter {
  if (event.scope === "couple") return "couple";
  if (currentUserId && event.createdByProfileId === currentUserId) return "me";
  if (partnerProfileId && event.createdByProfileId === partnerProfileId) {
    return "partner";
  }
  return "me";
}

function filterEvents(
  events: CalendarEvent[],
  selectedDate: Date,
  filter: EventFilter,
  currentUserId?: string | null,
  partnerProfileId?: string | null
): CalendarEvent[] {
  const selectedISO = toISODate(selectedDate);

  return events.filter((event) => {
    if (event.date !== selectedISO) return false;

    const category = getEventCategory(event, currentUserId, partnerProfileId);
    if (filter === "all") return true;
    return category === filter;
  });
}

export default function CalendarPage(): ReactElement {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<EventFilter>("all");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerProfileId, setPartnerProfileId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [sheetMode, setSheetMode] = useState<EventSheetMode>("create");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  const [newOwner, setNewOwner] = useState<NewEventOwner>("couple");
  const [eventDate, setEventDate] = useState<string>(toISODate(today));

  const weeks = useMemo(() => generateCalendarMatrix(viewDate), [viewDate]);

  const eventsForSelectedDay = useMemo(
    () =>
      filterEvents(
        events,
        selectedDate,
        filter,
        currentUserId,
        partnerProfileId
      ),
    [events, selectedDate, filter, currentUserId, partnerProfileId]
  );

  const selectedDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(selectedDate),
    [selectedDate]
  );

  const eventDateLabel = useMemo(() => {
    const baseDate = eventDate ? new Date(eventDate) : selectedDate;
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(baseDate);
  }, [eventDate, selectedDate]);

  // Load user + profilo + partner + eventi (calendar_events)
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setIsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.warn("Errore getUser", userError);
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, couple_id")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (profileError) {
        console.warn("Errore profilo", profileError);
      }

      if (!profile) {
        setCurrentUserId(user.id);
        setCoupleId(null);
        setIsLoading(false);
        return;
      }

      setCurrentUserId(profile.id);
      setCoupleId(profile.couple_id);

      let partnerId: string | null = null;

      if (profile.couple_id) {
        const { data: members, error: membersError } = await supabase
          .from("couple_members")
          .select("profile_id, couple_id")
          .eq("couple_id", profile.couple_id);

        if (!membersError && members && members.length > 0) {
          const others = (members as CoupleMemberRow[]).filter(
            (m) => m.profile_id !== profile.id
          );
          partnerId = others[0]?.profile_id ?? null;
        } else if (membersError) {
          console.warn("Errore couple_members", membersError);
        }
      }

      setPartnerProfileId(partnerId);

      let eventsQuery = supabase
        .from("calendar_events")
        .select(
          "id, title, date, time, scope, created_by_profile_id, couple_id"
        )
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (profile.couple_id) {
        eventsQuery = eventsQuery.eq("couple_id", profile.couple_id);
      } else {
        eventsQuery = eventsQuery.eq("created_by_profile_id", profile.id);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;

      if (!eventsError && eventsData) {
        const mapped = (eventsData as CalendarEventRow[]).map(mapRowToEvent);
        setEvents(mapped);
      } else if (eventsError) {
        console.warn("Errore caricamento eventi", eventsError);
      }

      setIsLoading(false);
    };

    void loadData();
  }, []);

  const handlePrevMonth = (): void => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = (): void => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleSelectDay = (day: Date): void => {
    setSelectedDate(day);
    setViewDate(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getDotsForDay = (day: Date): {
    me: boolean;
    partner: boolean;
    couple: boolean;
  } => {
    const dayISO = toISODate(day);
    const dots = { me: false, partner: false, couple: false };

    events.forEach((event) => {
      if (event.date !== dayISO) return;
      const category = getEventCategory(event, currentUserId, partnerProfileId);
      if (category === "me") dots.me = true;
      if (category === "partner") dots.partner = true;
      if (category === "couple") dots.couple = true;
    });

    return dots;
  };

  const openNewEventSheet = (): void => {
    setSheetMode("create");
    setEditingEventId(null);
    setNewTitle("");
    setNewTime("");
    setNewOwner("couple");
    setEventDate(toISODate(selectedDate));
    setIsEditingExisting(true); // irrilevante in create, ma teniamo true
    setIsSheetOpen(true);
  };

  const openEditEventSheet = (event: CalendarEvent): void => {
    setSheetMode("edit");
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewTime(event.time ?? "");
    const category = getEventCategory(event, currentUserId, partnerProfileId);
    let owner: NewEventOwner;
    if (category === "couple") owner = "couple";
    else if (category === "partner") owner = "partner";
    else owner = "me";
    setNewOwner(owner);
    setEventDate(event.date);
    setIsEditingExisting(false); // inizialmente solo visualizzazione
    setIsSheetOpen(true);
  };

  const closeEventSheet = (): void => {
    setIsSheetOpen(false);
  };

  const ensureCurrentUserId = async (): Promise<string | null> => {
    if (currentUserId) return currentUserId;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.warn("Impossibile recuperare user per inserimento evento", error);
      alert("Problema con l'autenticazione. Riprova tra poco.");
      return null;
    }

    setCurrentUserId(user.id);
    return user.id;
  };

  const handleSubmitEvent = async (
    e: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    const userId = await ensureCurrentUserId();
    if (!userId) return;

    const dateToUse = eventDate || toISODate(selectedDate);

    let scope: EventScope;
    let createdByProfileId: string;

    if (newOwner === "couple") {
      scope = "couple";
      createdByProfileId = userId;
    } else {
      scope = "personal";
      createdByProfileId =
        newOwner === "me" ? userId : partnerProfileId || userId;
    }

    const basePayload = {
      title: trimmedTitle,
      date: dateToUse,
      time: newTime || null,
      scope,
      created_by_profile_id: createdByProfileId,
      couple_id: coupleId,
    };

    if (sheetMode === "create") {
      const tempId = `local-${Date.now()}`;
      const optimisticEvent: CalendarEvent = {
        id: tempId,
        title: trimmedTitle,
        date: dateToUse,
        time: newTime || undefined,
        createdByProfileId,
        scope,
      };
      setEvents((prev) => [...prev, optimisticEvent]);

      const { data, error } = await supabase
        .from("calendar_events")
        .insert(basePayload)
        .select(
          "id, title, date, time, scope, created_by_profile_id, couple_id"
        )
        .single<CalendarEventRow>();

      if (error || !data) {
        console.warn("Errore inserimento evento", error);
        alert(
          `Errore durante il salvataggio dell'evento${
            (error as any)?.message ? `: ${(error as any).message}` : ""
          }`
        );
        setEvents((prev) => prev.filter((ev) => ev.id !== tempId));
      } else {
        const saved = mapRowToEvent(data);
        setEvents((prev) =>
          prev.map((ev) => (ev.id === tempId ? saved : ev))
        );
      }
    } else if (sheetMode === "edit" && editingEventId) {
      if (!isEditingExisting) {
        return;
      }

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEventId
            ? {
                ...ev,
                title: trimmedTitle,
                time: newTime || undefined,
                date: dateToUse,
                createdByProfileId,
                scope,
              }
            : ev
        )
      );

      const { data, error } = await supabase
        .from("calendar_events")
        .update(basePayload)
        .eq("id", editingEventId)
        .select(
          "id, title, date, time, scope, created_by_profile_id, couple_id"
        )
        .single<CalendarEventRow>();

      if (error || !data) {
        console.warn("Errore aggiornamento evento", error);
        alert(
          `Errore durante l'aggiornamento dell'evento${
            (error as any)?.message ? `: ${(error as any).message}` : ""
          }`
        );
      } else {
        const updated = mapRowToEvent(data);
        setEvents((prev) =>
          prev.map((ev) => (ev.id === editingEventId ? updated : ev))
        );
      }
      setIsEditingExisting(false);
    }

    // dopo salvataggio porto il calendario sul giorno dell'evento
    const targetDate = new Date(dateToUse);
    if (!Number.isNaN(targetDate.getTime())) {
      setSelectedDate(targetDate);
      setViewDate(
        new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      );
    }

    setIsSheetOpen(false);
  };

  const handleDeleteEvent = async (): Promise<void> => {
    if (!editingEventId) return;

    const previous = events;
    setEvents((prev) => prev.filter((ev) => ev.id !== editingEventId));

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", editingEventId);

    if (error) {
      console.warn("Errore cancellazione evento", error);
      alert(
        `Errore durante l'eliminazione dell'evento${
          (error as any)?.message ? `: ${(error as any).message}` : ""
        }`
      );
      setEvents(previous);
    }

    setIsSheetOpen(false);
  };

  const handleShareEvent = async (): Promise<void> => {
    if (!editingEventId) return;
    const ev = events.find((e) => e.id === editingEventId);
    if (!ev) return;

    const dateLabel = new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ev.date));
    const timeLabel = ev.time ? ` alle ${ev.time}` : "";
    const whoLabel =
      ev.scope === "couple"
        ? " (evento di coppia)"
        : ev.createdByProfileId === currentUserId
        ? " (mio)"
        : " (partner)";

    const text = `${ev.title}${timeLabel} - ${dateLabel}${whoLabel}`;

    try {
      const nav: any =
        typeof navigator !== "undefined" ? (navigator as any) : null;

      if (nav && typeof nav.share === "function") {
        await nav.share({
          title: ev.title,
          text,
        });
      } else if (
        nav &&
        nav.clipboard &&
        typeof nav.clipboard.writeText === "function"
      ) {
        await nav.clipboard.writeText(text);
        alert("Dettagli evento copiati negli appunti.");
      } else {
        alert(text);
      }
    } catch (err) {
      console.warn("Errore condivisione evento", err);
      alert("Non sono riuscito a condividere l'evento.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-20">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            noizb
          </span>
          <h1 className="text-xl font-semibold mt-1">Calendario</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-sm"
          >
            ‹
          </button>
          <span className="text-sm font-medium">{getMonthLabel(viewDate)}</span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-sm"
          >
            ›
          </button>
        </div>
      </header>

      {/* Filtri */}
      <section className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">
            Filtra impegni {isLoading && "(caricamento...)"}
          </span>
          <button
            type="button"
            className="text-[11px] underline text-slate-400"
            onClick={() => setFilter("all")}
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[11px] bg-slate-900 rounded-full p-1">
          <FilterChip
            label="Tutti"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Io"
            active={filter === "me"}
            onClick={() => setFilter("me")}
            colorClass="bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
          />
          <FilterChip
            label="Partner"
            active={filter === "partner"}
            onClick={() => setFilter("partner")}
            colorClass="bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          />
          <FilterChip
            label="Coppia"
            active={filter === "couple"}
            onClick={() => setFilter("couple")}
            colorClass="bg-pink-500/20 text-pink-300 border-pink-500/40"
          />
        </div>

        {/* Legenda puntini */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
          <LegendDot className="bg-cyan-400" label="Io" />
          <LegendDot className="bg-emerald-400" label="Partner" />
          <LegendDot className="bg-pink-400" label="Coppia" />
        </div>
      </section>

      {/* Calendario */}
      <section className="px-2">
        {/* Giorni della settimana */}
        <div className="grid grid-cols-7 text-[10px] text-center text-slate-500 mb-1">
          {weekdayLabels.map((day, index) => (
            <div key={`${day}-${index}`} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Griglia stile iPhone */}
        <div className="grid grid-rows-6 gap-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((day) => {
                const isToday = isSameDay(day.date, today);
                const isSelected = isSameDay(day.date, selectedDate);
                const dots = getDotsForDay(day.date);

                return (
                  <button
                    key={day.date.toISOString()}
                    type="button"
                    onClick={() => handleSelectDay(day.date)}
                    className={[
                      "relative mx-[2px] my-[1px] flex flex-col items-center justify-center rounded-2xl py-1.5 text-xs transition",
                      day.inCurrentMonth ? "text-slate-50" : "text-slate-600",
                      isSelected ? "bg-slate-100 text-slate-900" : "bg-transparent",
                      !isSelected && isToday && day.inCurrentMonth
                        ? "border border-slate-300/70"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="leading-none">
                      {day.date.getDate()}
                    </span>
                    <div className="mt-1 flex gap-[2px]">
                      {dots.me && (
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      )}
                      {dots.partner && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                      {dots.couple && (
                        <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* Lista eventi del giorno selezionato */}
      <section className="mt-4 px-4 pb-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Impegni del</span>
            <span className="text-sm font-medium capitalize">
              {selectedDateLabel}
            </span>
          </div>
          <button
            type="button"
            className="text-[11px] px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-medium"
            onClick={openNewEventSheet}
          >
            + Nuovo
          </button>
        </div>

        {eventsForSelectedDay.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-500 text-center px-6">
              Nessun evento per questo giorno
              {filter !== "all" && " con il filtro selezionato"}.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 overflow-y-auto">
            {eventsForSelectedDay.map((event) => {
              const category = getEventCategory(
                event,
                currentUserId,
                partnerProfileId
              );

              const badge =
                category === "couple"
                  ? { label: "Coppia", className: "bg-pink-500/15 text-pink-300" }
                  : category === "me"
                  ? { label: "Io", className: "bg-cyan-500/15 text-cyan-300" }
                  : {
                      label: "Partner",
                      className: "bg-emerald-500/15 text-emerald-300",
                    };

              return (
                <li
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditEventSheet(event)}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 px-3 py-2.5 flex items-start justify-between cursor-pointer active:scale-[0.99] transition"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{event.title}</span>
                    {event.time && (
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {event.time}
                      </span>
                    )}
                  </div>
                  <span
                    className={`ml-2 px-2 py-[2px] rounded-full text-[10px] font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Schermata evento a tutta pagina */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50">
          <div
            className="absolute inset-0"
            onClick={closeEventSheet}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitEvent}
            className="relative w-full max-w-md mx-auto h-full bg-slate-950 border-l border-r border-slate-800 px-4 pt-4 pb-4 shadow-2xl flex flex-col"
          >
            {/* Header dettaglio */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                className="text-[11px] text-slate-400"
                onClick={closeEventSheet}
              >
                Chiudi
              </button>
              <span className="text-sm font-medium">
                {sheetMode === "create" ? "Nuovo evento" : "Dettaglio evento"}
              </span>
              <span className="w-10" />
            </div>

            {/* Contenuto */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">Titolo</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={sheetMode === "edit" && !isEditingExisting}
                  placeholder="Es. Cena, visita, appuntamento..."
                  className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                    sheetMode === "edit" && !isEditingExisting
                      ? "bg-slate-900 border-slate-800 text-slate-300"
                      : "bg-slate-900 border-slate-700"
                  }`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Data evento
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={sheetMode === "edit" && !isEditingExisting}
                  className={`w-40 rounded-2xl border px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                    sheetMode === "edit" && !isEditingExisting
                      ? "bg-slate-900 border-slate-800 text-slate-300"
                      : "bg-slate-900 border-slate-700"
                  }`}
                />
                <span className="text-[10px] text-slate-500 capitalize">
                  {eventDateLabel}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Ora (opzionale)
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  disabled={sheetMode === "edit" && !isEditingExisting}
                  className={`w-32 rounded-2xl border px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60 ${
                    sheetMode === "edit" && !isEditingExisting
                      ? "bg-slate-900 border-slate-800 text-slate-300"
                      : "bg-slate-900 border-slate-700"
                  }`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  A chi appartiene
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-900 rounded-full p-1 text-[11px]">
                  <ToggleChip
                    label="Io"
                    active={newOwner === "me"}
                    onClick={() => {
                      if (sheetMode === "edit" && !isEditingExisting) return;
                      setNewOwner("me");
                    }}
                    className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    disabled={sheetMode === "edit" && !isEditingExisting}
                  />
                  <ToggleChip
                    label="Partner"
                    active={newOwner === "partner"}
                    onClick={() => {
                      if (sheetMode === "edit" && !isEditingExisting) return;
                      setNewOwner("partner");
                    }}
                    className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    disabled={sheetMode === "edit" && !isEditingExisting}
                  />
                  <ToggleChip
                    label="Coppia"
                    active={newOwner === "couple"}
                    onClick={() => {
                      if (sheetMode === "edit" && !isEditingExisting) return;
                      setNewOwner("couple");
                    }}
                    className="bg-pink-500/20 text-pink-300 border-pink-500/40"
                    disabled={sheetMode === "edit" && !isEditingExisting}
                  />
                </div>
              </div>
            </div>

            {/* Bottoni azione */}
            <div className="mt-4 space-y-2">
              {sheetMode === "edit" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingExisting(true)}
                      className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
                    >
                      Modifica evento
                    </button>
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-100 text-slate-900 px-3 py-2 text-sm font-medium disabled:opacity-40"
                      disabled={!isEditingExisting || !newTitle.trim()}
                    >
                      Salva evento
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteEvent}
                      className="rounded-2xl border border-red-500/60 bg-red-500/5 px-3 py-2 text-sm text-red-300"
                    >
                      Elimina evento
                    </button>
                    <button
                      type="button"
                      onClick={handleShareEvent}
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                    >
                      Condividi evento
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={closeEventSheet}
                    className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-100 text-slate-900 px-3 py-2 text-sm font-medium disabled:opacity-40"
                    disabled={!newTitle.trim()}
                  >
                    Salva evento
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
}

function FilterChip({
  label,
  active,
  onClick,
  colorClass,
}: FilterChipProps): ReactElement {
  const baseActive =
    colorClass ??
    "bg-slate-100 text-slate-900 border border-slate-100/80 shadow-sm";
  const baseInactive = "bg-transparent text-slate-400 border border-transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-1 text-[11px] font-medium text-center transition ${
        active ? baseActive : baseInactive
      }`}
    >
      {label}
    </button>
  );
}

interface LegendDotProps {
  className: string;
  label: string;
}

function LegendDot({ className, label }: LegendDotProps): ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}

interface ToggleChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  className: string;
  disabled?: boolean;
}

function ToggleChip({
  label,
  active,
  onClick,
  className,
  disabled,
}: ToggleChipProps): ReactElement {
  const activeClasses = className;
  const inactiveClasses =
    "bg-transparent text-slate-400 border border-transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-2 py-1 text-center font-medium transition ${
        active ? activeClasses : inactiveClasses
      } ${disabled ? "opacity-50" : ""}`}
    >
      {label}
    </button>
  );
}
