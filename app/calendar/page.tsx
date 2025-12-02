// app/calendar/page.tsx
"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type EventScope = "personal" | "couple";
type EventFilter = "all" | "me" | "partner" | "couple";

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO locale "YYYY-MM-DD"
  time?: string; // "HH:MM"
  createdByUserId: string;
  scope: EventScope;
  isForCouple: boolean;
}

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
}

interface CalendarEventRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  is_for_couple: boolean;
  created_by: string;
  couple_id: string | null;
}

interface CoupleMemberRow {
  user_id: string;
  couple_id: string;
}

const weekdayLabels = ["L", "M", "M", "G", "V", "S", "D"];

/**
 * Data "YYYY-MM-DD" in **locale**, non UTC.
 */
function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // 0 = Lunedì ... 6 = Domenica
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

/**
 * Mappa la riga DB -> evento UI usando **data locale**.
 */
function mapRowToEvent(row: CalendarEventRow): CalendarEvent {
  const start = new Date(row.start_at);
  const date = toLocalISODate(start);

  let time: string | undefined;
  if (!row.all_day) {
    const hours = `${start.getHours()}`.padStart(2, "0");
    const minutes = `${start.getMinutes()}`.padStart(2, "0");
    time = `${hours}:${minutes}`;
  }

  return {
    id: row.id,
    title: row.title,
    date,
    time,
    createdByUserId: row.created_by,
    scope: row.is_for_couple ? "couple" : "personal",
    isForCouple: row.is_for_couple,
  };
}

function getEventCategory(
  event: CalendarEvent,
  currentUserId?: string | null,
  partnerUserId?: string | null
): EventFilter {
  if (event.isForCouple) return "couple";
  if (currentUserId && event.createdByUserId === currentUserId) return "me";
  if (partnerUserId && event.createdByUserId === partnerUserId) {
    return "partner";
  }
  return "me";
}

function filterEvents(
  events: CalendarEvent[],
  selectedDate: Date,
  filter: EventFilter,
  currentUserId?: string | null,
  partnerUserId?: string | null
): CalendarEvent[] {
  const selectedISO = toLocalISODate(selectedDate);

  return events.filter((event) => {
    if (event.date !== selectedISO) return false;

    const category = getEventCategory(event, currentUserId, partnerUserId);
    if (filter === "all") return true;
    return category === filter;
  });
}

export default function CalendarPage(): ReactElement {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [viewDate, setViewDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<EventFilter>("all");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(() => generateCalendarMatrix(viewDate), [viewDate]);

  const eventsForSelectedDay = useMemo(
    () =>
      filterEvents(
        events,
        selectedDate,
        filter,
        currentUserId,
        partnerUserId
      ),
    [events, selectedDate, filter, currentUserId, partnerUserId]
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

  // Load user, coppia, partner, eventi (tabella `calendario`)
  useEffect(() => {
    let isMounted = true;

    const loadData = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw userError ?? new Error("Utente non autenticato");
        }

        const userId = user.id as string;
        if (!isMounted) return;

        setCurrentUserId(userId);

        // coppia a cui appartengo
        const { data: myCoupleRows, error: coupleError } = await supabase
          .from("couple_members")
          .select("user_id, couple_id")
          .eq("user_id", userId)
          .limit(1);

        if (coupleError) throw coupleError;

        const coupleId =
          myCoupleRows && myCoupleRows.length > 0
            ? (myCoupleRows[0].couple_id as string)
            : null;

        let partnerId: string | null = null;

        if (coupleId) {
          const { data: members, error: membersError } = await supabase
            .from("couple_members")
            .select("user_id, couple_id")
            .eq("couple_id", coupleId);

          if (membersError) throw membersError;

          const others = (members as CoupleMemberRow[]).filter(
            (m) => m.user_id !== userId
          );
          partnerId = others[0]?.user_id ?? null;
        }

        if (!isMounted) return;
        setPartnerUserId(partnerId);

        // Eventi (RLS filtra già su created_by/coppia)
        const { data: eventsData, error: eventsError } = await supabase
          .from("calendario")
          .select(
            "id, title, start_at, end_at, all_day, is_for_couple, created_by, couple_id"
          )
          .order("start_at", { ascending: true });

        if (eventsError) throw eventsError;

        if (!isMounted) return;

        const mapped = (eventsData as CalendarEventRow[]).map(mapRowToEvent);
        setEvents(mapped);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError("Errore nel caricamento del calendario.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
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
    const dayISO = toLocalISODate(day);
    const dots = { me: false, partner: false, couple: false };

    events.forEach((event) => {
      if (event.date !== dayISO) return;
      const category = getEventCategory(event, currentUserId, partnerUserId);
      if (category === "me") dots.me = true;
      if (category === "partner") dots.partner = true;
      if (category === "couple") dots.couple = true;
    });

    return dots;
  };

  const openNewEventPage = (): void => {
    const dateStr = toLocalISODate(selectedDate);
    router.push(`/calendar/new?date=${encodeURIComponent(dateStr)}`);
  };

  const openEventDetailPage = (eventId: string): void => {
    router.push(`/calendar/${eventId}`);
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
          <span className="text-sm font-medium">
            {getMonthLabel(viewDate)}
          </span>
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

        {error && (
          <p className="mt-2 text-[11px] text-red-400">{error}</p>
        )}
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
                      isSelected
                        ? "bg-slate-100 text-slate-900"
                        : "bg-transparent",
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
            onClick={openNewEventPage}
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
                partnerUserId
              );

              const badge =
                category === "couple"
                  ? {
                      label: "Coppia",
                      className: "bg-pink-500/15 text-pink-300",
                    }
                  : category === "me"
                  ? {
                      label: "Io",
                      className: "bg-cyan-500/15 text-cyan-300",
                    }
                  : {
                      label: "Partner",
                      className: "bg-emerald-500/15 text-emerald-300",
                    };

              return (
                <li
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEventDetailPage(event.id)}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 px-3 py-2.5 flex items-start justify-between cursor-pointer active:scale-[0.99] transition"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {event.title}
                    </span>
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
