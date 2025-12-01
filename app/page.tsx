"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { ProtectedPage } from "../components/ProtectedPage";

type UpcomingEvent = {
  id: number;
  title: string;
  date: string;
  time?: string;
  type: "coppia" | "task";
};

type PreviewItem = {
  id: number;
  label: string;
  urgent?: boolean;
};

const upcomingEventsMock: UpcomingEvent[] = [
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
    type: "task",
  },
];

const shoppingPreviewMock: PreviewItem[] = [
  { id: 1, label: "Carta igienica", urgent: true },
  { id: 2, label: "Regalo Leo", urgent: true },
  { id: 3, label: "Caffè" },
];

export default function DashboardPage() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        {/* Barra top con nome app e logout */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-pink-400">
              noizb
            </p>
            <p className="text-xs text-slate-400">
              App di coppia · privata
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Esci
          </button>
        </div>

        {/* Benvenuto */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-50">
            Ciao 👋
          </h1>
          <p className="text-sm text-slate-400">
            Qui teniamo insieme impegni, lista acquisti e progetti di coppia.
          </p>
        </header>

        {/* Prossimi eventi */}
        <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/90 p-4 shadow-lg shadow-pink-500/10">
          <div className="mb-3 flex items-center justify-between">
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

          <div className="space-y-3">
            {upcomingEventsMock.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between rounded-2xl bg-slate-800/80 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-50">
                    {event.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {event.date}
                    {event.time ? ` · ${event.time}` : ""}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    (event.type === "coppia"
                      ? "bg-pink-500/15 text-pink-300"
                      : "bg-sky-500/15 text-sky-300")
                  }
                >
                  {event.type === "coppia" ? "Coppia" : "Da fare"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Lista acquisti preview */}
        <section className="rounded-3xl border border-white/5 bg-slate-900/80 p-4 shadow-lg shadow-sky-500/10">
          <div className="mb-3 flex items-center justify-between">
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

          <div className="space-y-2">
            {shoppingPreviewMock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-slate-800/80 px-3 py-2"
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
    </ProtectedPage>
  );
}
