export default function DashboardPage() {
  const upcomingEvents = [
    {
      id: 1,
      title: "Cena da Francesca e Luca",
      date: "2025-12-20",
      time: "20:30",
      type: "coppia",
    },
    {
      id: 2,
      title: "Comprare regalo Leo",
      date: "2025-12-22",
      time: "",
      type: "task",
    },
  ];

  const shoppingPreview = [
    { id: 1, label: "Carta igienica", urgent: true },
    { id: 2, label: "Regalo Leo", urgent: true },
    { id: 3, label: "Caffè", urgent: false },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-pink-400">
          noizb
        </p>
        <h1 className="text-2xl font-semibold">
          Ciao 👋
          <span className="text-slate-300"> questa è la nostra base operativa</span>
        </h1>
        <p className="text-sm text-slate-400">
          Prossimi impegni e cose da non dimenticare.
        </p>
      </header>

      {/* Prossimi eventi */}
      <section className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg shadow-pink-500/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            Prossimi eventi
          </h2>
          <span className="text-xs text-slate-400">Calendario</span>
        </div>

        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between rounded-xl bg-slate-800/80 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-50">
                  {event.title}
                </p>
                <p className="text-xs text-slate-400">
                  {event.date} {event.time && `• ${event.time}`}
                </p>
              </div>
              <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-300">
                {event.type === "coppia" ? "Coppia" : "Da fare"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Lista acquisti preview */}
      <section className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-lg shadow-sky-500/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            Lista acquisti
          </h2>
          <span className="text-xs text-slate-400">Vedi tutto nella tab Lista</span>
        </div>

        <div className="space-y-2">
          {shoppingPreview.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2"
            >
              <p className="text-sm text-slate-50">{item.label}</p>
              {item.urgent && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Urgente
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
