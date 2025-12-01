"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      // Se arrivo qui → login ok
      router.replace("/");
    } catch (err: any) {
      const msg = err?.message || "Errore di autenticazione";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-pink-500/20 backdrop-blur-md">
        {/* Logo / titolo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-2xl">
            💞
          </div>
          <h1 className="text-2xl font-semibold text-slate-50">noizb</h1>
          <p className="mt-1 text-xs text-slate-400">
            La tua app di coppia, privata e condivisa.
          </p>
        </div>

        {/* Toggle login / signup */}
        <div className="mb-4 flex rounded-full bg-slate-900/90 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium ${
              mode === "login"
                ? "bg-pink-500 text-white"
                : "text-slate-300"
            }`}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium ${
              mode === "signup"
                ? "bg-pink-500 text-white"
                : "text-slate-300"
            }`}
          >
            Registrati
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
              placeholder="es. bea@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
              placeholder="Minimo 6 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="text-xs text-pink-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
          >
            {loading
              ? "Attendere..."
              : mode === "login"
              ? "Accedi"
              : "Crea il tuo account"}
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          La sessione rimane attiva finché non scegli di disconnetterti dal menu.
        </p>
      </div>
    </div>
  );
}
