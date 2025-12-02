// app/calendar/page.tsx
"use client";

import React, {
  useMemo,
  useState,
  type ReactElement,
  type FormEvent,
} from "react";

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

// TODO: collega questi ID a Supabase (utente loggato + partner)
const CURRENT_USER_ID = "me-profile-id";
const PARTNER_PROFILE_ID = "partner-profile-id";

// TODO: sostituisci questi mock con una query a Supabase
const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Cena insieme",
    date: "2025-12-03",
    time: "20:00",
    createdByProfileId: CURRENT_USER_ID,
    scope: "couple",
  },
  {
    id: "2",
    title: "Dentista Bea",
    date: "2025-12-04",
    time: "15:30",
    createdByProfileId: CURRENT_USER_ID,
    scope: "personal",
  },
  {
    id: "3",
    title: "Allenamento Kekko",
    date: "2025-12-04",
    time: "18:00",
    createdByProfileId: PARTNER_PROFILE_ID,
    scope: "personal",
  },
  {
    id: "4",
    title: "Weekend fuori",
    date: "2025-12-08",
    time: "09:00",
    createdByProfileId: CURRENT_USER_ID,
    scope: "couple",
  },
];

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

// Settimana che parte da lunedì (stile EU/iOS)
function generateCalendarMatrix(viewDate: Date): CalendarDay[][] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  // getDay(): 0 Sunday → normalizziamo a Monday = 0
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

  // Giorni del mese successivo per completare la griglia (6x7)
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

function getEventCategory(
  event: CalendarEvent,
  currentUserId: string,
  partnerProfileId: string | null
): EventFilter {
  if (event.scope === "couple") return "couple";
  if (event.createdByProfileId === currentUserId) return "me";
  if (partnerProfileId && event.createdByProfileId === partnerProfileId) {
    return "partner";
  }
  return "me";
}

function filterEvents(
  events: CalendarEvent[],
  selectedDate: Date,
  filter: EventFilter,
  currentUserId: string,
  partnerProfileId: string | null
): CalendarEvent[] {
  const selectedISO = toISODate(selectedDate);

  return events.filter((event) => {
    if (event.date !== selectedISO) return false;

    const category = getEventCategory(event, currentUserId, partnerProfileId);
    if (filter === "all") return true;
    return category === filter;
  });
}

const weekdayLabels = ["L", "M", "M", "G", "V", "S", "D"];

export default function CalendarPage(): ReactElement {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<EventFilter>("all");

  // Stato eventi (mock iniziale + modifiche locali)
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_EVENTS);

  // Stato bottom sheet evento (create/edit)
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [sheetMode, setSheetMode] = useState<EventSheetMode>("create");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form campi
  const [newTitle, setNewTitle] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  const [newOwner, setNewOwner] = useState<NewEventOwner>("couple");

  const weeks = useMemo(() => generateCalendarMatrix(viewDate), [viewDate]);

  const eventsForSelectedDay = useMemo(
    () => filterEvents(events, selectedDate, filter, CURRENT_USER_ID, PARTNER_PROFILE_ID),
    [events, selectedDate, filter]
  );

  const handlePrevMonth = (): void => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (): void => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: Date): void => {
    setSelectedDate(day);
    setViewDate(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getDotsForDay = (day: Date): { me: boolean; partner: boolean; couple: boolean } => {
    const dayISO = toISODate(day);
    const dots = { me: false, partner: false, couple: false };

    events.forEach((event) => {
      if (event.date !== dayISO) return;
      const category = getEventCategory(event, CURRENT_USER_ID, PARTNER_PROFILE_ID);
      if (category === "me") dots.me = true;
      if (category === "partner") dots.partner = true;
      if (category === "couple") dots.couple = true;
    });

    return dots;
  };

  const selectedDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(selectedDate),
    [selectedDate]
  );

  const openNewEventSheet = (): void => {
    setSheetMode("create");
    setEditingEventId(null);
    setNewTitle("");
    setNewTime("");
    setNewOwner("couple");
    setIsSheetOpen(true);
  };

  const openEditEventSheet = (event: CalendarEvent): void => {
    setSheetMode("edit");
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewTime(event.time ?? "");
    const category = getEventCategory(event, CURRENT_USER_ID, PARTNER_PROFILE_ID);
    // mappo categoria → owner per il form
    let owner: NewEventOwner;
    if (category === "couple") owner = "couple";
    else if (category === "partner") owner = "partner";
    else owner = "me";
    setNewOwner(owner);
    setIsSheetOpen(true);
  };

  const closeEventSheet = (): void => {
    setIsSheetOpen(false);
  };

  const handleSubmitEvent = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    let scope: EventScope;
    let createdByProfileId: string;

    if (newOwner === "couple") {
      scope = "couple";
      createdByProfileId = CURRENT_USER_ID;
    } else {
      scope = "personal";
      createdByProfileId =
        newOwner === "me"
          ? CURRENT_USER_ID
          : PARTNER_PROFILE_ID || CURRENT_USER_ID;
    }

    if (sheetMode === "create") {
      const newEvent: CalendarEvent = {
        id: `local-${Date.now()}`,
        title: trimmedTitle,
        date: toISODate(selectedDate),
        time: newTime || undefined,
        createdByProfileId,
        scope,
      };
      setEvents((prev) => [...prev, newEvent]);
    } else if (sheetMode === "edit" && editingEventId) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEventId
            ? {
                ...ev,
                title: trimmedTitle,
                time: newTime || undefined,
                createdByProfileId,
                scope,
              }
            : ev
        )
      );
    }

    setIsSheetOpen(false);
  };

  const handleDeleteEvent = (): void => {
    if (!editingEventId) return;
    setEvents((prev) => prev.filter((ev) => ev.id !== editingEventId));
    setIsSheetOpen(false);
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
          <span className="text-xs text-slate-400">Filtra impegni</span>
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
                CURRENT_USER_ID,
                PARTNER_PROFILE_ID
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

      {/* Bottom sheet crea/modifica evento */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div
            className="absolute inset-0"
            onClick={closeEventSheet}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitEvent}
            className="relative w-full max-w-md mx-auto rounded-t-3xl bg-slate-950 border-t border-slate-800 px-4 pt-3 pb-5 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">
                {sheetMode === "create" ? "Nuovo evento" : "Modifica evento"}
              </span>
              <button
                type="button"
                className="text-[11px] text-slate-400"
                onClick={closeEventSheet}
              >
                Chiudi
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">Titolo</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Es. Cena, visita, appuntamento..."
                  className="w-full rounded-2xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Ora (opzionale)
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-32 rounded-2xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
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
                    onClick={() => setNewOwner("me")}
                    className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  />
                  <ToggleChip
                    label="Partner"
                    active={newOwner === "partner"}
                    onClick={() => setNewOwner("partner")}
                    className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  />
                  <ToggleChip
                    label="Coppia"
                    active={newOwner === "couple"}
                    onClick={() => setNewOwner("couple")}
                    className="bg-pink-500/20 text-pink-300 border-pink-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Data</span>
                <span className="font-medium capitalize">
                  {selectedDateLabel}
                </span>
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={closeEventSheet}
                  className="flex-1 rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-slate-100 text-slate-900 px-3 py-2 text-sm font-medium disabled:opacity-40"
                  disabled={!newTitle.trim()}
                >
                  {sheetMode === "create" ? "Salva" : "Aggiorna"}
                </button>
              </div>

              {sheetMode === "edit" && (
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  className="mt-2 w-full rounded-2xl border border-red-500/60 bg-red-500/5 px-3 py-2 text-sm text-red-300"
                >
                  Elimina evento
                </button>
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
}

function ToggleChip({
  label,
  active,
  onClick,
  className,
}: ToggleChipProps): ReactElement {
  const activeClasses = className;
  const inactiveClasses = "bg-transparent text-slate-400 border border-transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-1 text-center font-medium transition ${
        active ? activeClasses : inactiveClasses
      }`}
    >
      {label}
    </button>
  );
}
