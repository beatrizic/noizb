"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedPage } from "../../components/ProtectedPage";

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Carica utente + profilo all'apertura della pagina
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setError(null);
      setMessage(null);

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

        setUserEmail(user.email ?? "");

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          if (!cancelled) {
            setError(profileError.message);
          }
          return;
        }

        if (!cancelled && data) {
          setDisplayName(data.display_name ?? "");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Errore nel caricamento del profilo.");
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessione non valida, effettua di nuovo l'accesso.");
        return;
      }

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            display_name: displayName || null,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) throw upsertError;

      setMessage("Profilo salvato.");
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio del profilo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedPage>
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-50">Profilo</h1>
          <p className="text-sm text-slate-400">
            I tuoi dati personali nell&apos;app di coppia.
          </p>
        </header>

        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/70 p-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-white/5 bg-slate-800/60 px-3 py-2 text-sm text-slate-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Nome visualizzato
            </label>
            <input
              type="text"
            placeholder="Es. Bea"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
            />
          </div>

          {error && (
            <p className="text-xs text-pink-300">{error}</p>
          )}
          {message && !error && (
            <p className="text-xs text-emerald-300">{message}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
          >
            {saving ? "Salvataggio..." : "Salva profilo"}
          </button>
        </form>
      </div>
    </ProtectedPage>
  );
}
