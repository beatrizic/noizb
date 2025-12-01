"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedPage } from "../../components/ProtectedPage";

type Couple = {
  id: string;
  name: string | null;
};

type Invite = {
  id: string;
  invited_email: string;
  code: string;
  used: boolean;
};

export default function PartnerPage() {
  const [userEmail, setUserEmail] = useState("");
  const [couple, setCouple] = useState<Couple | null>(null);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);

  const [newCoupleName, setNewCoupleName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [creatingCouple, setCreatingCouple] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
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

        // 1) Trova se l'utente è già membro di una coppia
        const { data: memberRows, error: memberError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .limit(1);

        if (memberError) throw memberError;

        if (!memberRows || memberRows.length === 0) {
          if (!cancelled) {
            setCouple(null);
            setMemberCount(1);
            setLastInvite(null);
          }
          return;
        }

        const coupleId = memberRows[0].couple_id as string;

        // 2) Carica coppia
        const { data: coupleRow, error: coupleError } = await supabase
          .from("couples")
          .select("id, name")
          .eq("id", coupleId)
          .single();

        if (coupleError) throw coupleError;

        // 3) Conta membri
        const { data: members, error: membersError } = await supabase
          .from("couple_members")
          .select("id")
          .eq("couple_id", coupleId);

        if (membersError) throw membersError;

        // 4) Ultimo invito
        const { data: invites, error: invitesError } = await supabase
          .from("couple_invites")
          .select("id, invited_email, code, used")
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (invitesError) throw invitesError;

        if (!cancelled) {
          setCouple(coupleRow as Couple);
          setMemberCount(members ? members.length : 1);
          setLastInvite(invites && invites.length > 0 ? (invites[0] as Invite) : null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Errore nel caricamento dei dati partner.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function handleCreateCouple(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCouple(true);
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

      const { data: coupleInsert, error: coupleError } = await supabase
        .from("couples")
        .insert({ name: newCoupleName || null })
        .select("id, name")
        .single();

      if (coupleError || !coupleInsert) {
        throw coupleError || new Error("Errore nella creazione della coppia.");
      }

      const { error: memberError } = await supabase
        .from("couple_members")
        .insert({
          couple_id: coupleInsert.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      setCouple(coupleInsert as Couple);
      setMemberCount(1);
      setMessage("Coppia creata. Ora puoi invitare il tuo partner.");
    } catch (err: any) {
      setError(err.message ?? "Errore durante la creazione della coppia.");
    } finally {
      setCreatingCouple(false);
    }
  }

  async function handleInvitePartner(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);

    if (!couple) {
      setError("Devi prima creare una coppia.");
      setInviting(false);
      return;
    }

    try {
      const code = generateInviteCode();

      const { data, error: inviteError } = await supabase
        .from("couple_invites")
        .insert({
          couple_id: couple.id,
          invited_email: partnerEmail,
          code,
        })
        .select("id, invited_email, code, used")
        .single();

      if (inviteError || !data) {
        throw inviteError || new Error("Errore nella creazione dell'invito.");
      }

      setLastInvite(data as Invite);
      setMessage("Invito creato. Condividi il codice con il tuo partner.");
    } catch (err: any) {
      setError(err.message ?? "Errore durante la creazione dell'invito.");
    } finally {
      setInviting(false);
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    setMessage(null);

    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) {
      setError("Inserisci un codice invito.");
      setJoining(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessione non valida, effettua di nuovo l'accesso.");
        setJoining(false);
        return;
      }

      const { data: invite, error: inviteError } = await supabase
        .from("couple_invites")
        .select("id, couple_id, used")
        .eq("code", code)
        .maybeSingle();

      if (inviteError) throw inviteError;

      if (!invite) {
        setError("Codice non valido.");
        setJoining(false);
        return;
      }

      if (invite.used) {
        setError("Questo codice è già stato utilizzato.");
        setJoining(false);
        return;
      }

      const { error: memberError } = await supabase
        .from("couple_members")
        .insert({
          couple_id: invite.couple_id,
          user_id: user.id,
          role: "partner",
        });

      if (memberError) throw memberError;

      const { error: updateError } = await supabase
        .from("couple_invites")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (updateError) throw updateError;

      setMessage("Ti sei unito alla coppia.");
      setMemberCount((prev) => prev + 1);

      if (!couple) {
        const { data: coupleRow, error: coupleError } = await supabase
          .from("couples")
          .select("id, name")
          .eq("id", invite.couple_id)
          .single();

        if (coupleError) throw coupleError;
        setCouple(coupleRow as Couple);
      }
    } catch (err: any) {
      setError(err.message ?? "Errore durante il join della coppia.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-50">Partner</h1>
          <p className="text-sm text-slate-400">
            Collega il tuo account a quello del tuo partner e condividete la coppia.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-300">Caricamento dati...</p>
        ) : (
          <>
            {/* Stato attuale */}
            <section className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 space-y-2">
              <p className="text-xs text-slate-400">Il tuo account</p>
              <p className="text-sm text-slate-100">{userEmail}</p>

              {couple ? (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-slate-400">Coppia collegata</p>
                  <p className="text-sm font-medium text-slate-50">
                    {couple.name || "Coppia senza nome"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Membri collegati: {memberCount}
                  </p>
                  {memberCount >= 2 && (
                    <p className="text-[11px] text-emerald-300">
                      Il tuo partner risulta già collegato a questa coppia.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Ancora nessuna coppia associata al tuo account.
                </p>
              )}
            </section>

            {/* Crea coppia se non esiste */}
            {!couple && (
              <section className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  Crea una nuova coppia
                </h2>
                <form onSubmit={handleCreateCouple} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Nome della coppia (opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Bea & Kekko"
                      value={newCoupleName}
                      onChange={(e) => setNewCoupleName(e.target.value)}
                      className="w-full rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingCouple}
                    className="w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
                  >
                    {creatingCouple ? "Creazione..." : "Crea coppia"}
                  </button>
                </form>
              </section>
            )}

            {/* Invita partner se ho già una coppia */}
            {couple && (
              <section className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  Invita il tuo partner
                </h2>
                <form onSubmit={handleInvitePartner} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Email del partner
                    </label>
                    <input
                      type="email"
                      placeholder="es. partner@example.com"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
                  >
                    {inviting ? "Creazione invito..." : "Crea invito con codice"}
                  </button>
                </form>

                {lastInvite && (
                  <div className="mt-3 rounded-xl bg-slate-950/80 p-3 text-xs text-slate-200">
                    <p className="font-semibold text-slate-50">
                      Ultimo invito
                    </p>
                    <p className="mt-1">
                      Email partner:{" "}
                      <span className="font-medium text-slate-100">
                        {lastInvite.invited_email}
                      </span>
                    </p>
                    <p className="mt-1">
                      Codice invito:{" "}
                      <span className="font-mono text-pink-300">
                        {lastInvite.code}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Condividi questo codice con il tuo partner.  
                      Il partner deve inserirlo nella sezione &quot;Ho un codice invito&quot; dopo essersi registrato.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Join tramite codice */}
            <section className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Ho un codice invito
              </h2>
              <form onSubmit={handleJoinByCode} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Codice invito
                  </label>
                  <input
                    type="text"
                    placeholder="Es. ABC123"
                    value={inviteCodeInput}
                    onChange={(e) =>
                      setInviteCodeInput(e.target.value.toUpperCase())
                    }
                    className="w-full rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joining}
                  className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                >
                  {joining ? "Verifica codice..." : "Unisciti alla coppia"}
                </button>
              </form>
            </section>

            {error && (
              <p className="text-xs text-pink-300">{error}</p>
            )}
            {message && !error && (
              <p className="text-xs text-emerald-300">{message}</p>
            )}
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
