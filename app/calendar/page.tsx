type CalendarEvent = {
  id: number;
  title: string;
  date: string; // formato YYYY-MM-DD
  time?: string;
  type: "coppia" | "bea" | "kekko";
};

const mockEvents: CalendarEvent[] = [
  {
    id: 1,
    title: "Cena da Francesca e Luca",
    date: "2025-12-20",
    time: "20:30",
    type: "coppia",
  },
  {
    id: 2,
    title: "Visita medica Bea",
    date: "2025-12-18",
    time: "14:00",
    type: "bea",
  },
  {
    id: 3,
    title: "Allenamento Kekko",
    date: "2025-12-19",
    time: "19:00",
    type: "kekko",
  },
];

const typeLabel: Record<CalendarEvent["type"], string> = {
  coppia: "Coppia",
  bea: "Bea",
  kekko: "Kekko",
};

const typeColor: Record<CalendarEvent["type"], string> = {
  coppia: "bg-pink-500/15 text-pink-300",
  bea: "bg-sky-500/15 text-sky-300",
  kekko: "bg-emerald-500/15 text-emerald-300",
};

export default function CalendarPage() {
  // In futuro qui ordiniamo eventi per data
  const events = mockEvents;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-50">Calendario</h1>
        <p className="text-sm text-slate-400">
          Tutti gli impegni di coppia e personali in un unico posto.
        </p>
      </header>

      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-slate-400">Legenda</p>
          <div className="flex gap-2 text-[10px] text-slate-300">
            <span className="rounded-full bg-pink-500/15 px-2 py-0.5">
              Coppia
            </span>
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5">
              Bea
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5">
              Kekko
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-50">
                  {event.title}
                </p>
                <p className="text-xs text-slate-400">
                  {event.date}
                  {event.time ? ` • ${event.time}` : ""}
                </p>
              </div>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                  typeColor[event.type]
                }
              >
                {typeLabel[event.type]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
