"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedPage } from "../../components/ProtectedPage";

type Couple = {
  id: string;
  name: string | null;
  anniversary_date: string | null;
};

type Invite = {
  id: string;
  invited_email: string;
  code: string;
  used: boolean;
};

export default function ProfilePage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [couple, setCouple] = useState<Couple | null>(null);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);
  const [anniversaryDate, setAnniversaryDate] = useState<string | null>(null);

  const [newCoupleName, setNewCoupleName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingCouple, setCreatingCouple] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [savingAnniversary, setSavingAnniversary] = useState(false);

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

        // Profilo
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (!cancelled && profile) {
          setDisplayName(profile.display_name ?? "");
        }

        // Coppia
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
            setAnniversaryDate(null);
          }
          return;
        }

        const coupleId = memberRows[0].couple_id as string;

        // Dettagli coppia
        const { data: coupleRow, error: coupleError } = await supabase
          .from("couples")
          .select("id, name, anniversary_date")
          .eq("id", coupleId)
          .single();

        if (coupleError) throw coupleError;

        // Conta membri
        const { data: members, error: membersError } = await supabase
          .from("couple_members")
          .select("id")
          .eq("couple_id", coupleId);

        if (membersError) throw membersError;

        // Ultimo invito
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
          setAnniversaryDate(coupleRow?.anniversary_date ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Errore nel caricamento del profilo.");
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

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
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

      setMessage("Profilo aggiornato.");
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio del profilo.");
    } finally {
      setSavingProfile(false);
    }
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
        .select("id, name, anniversary_date")
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
      setAnniversaryDate(coupleInsert.anniversary_date ?? null);
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

      const { data: coupleRow, error: coupleError } = await supabase
        .from("couples")
        .select("id, name, anniversary_date")
        .eq("id", invite.couple_id)
        .single();

      if (coupleError) throw coupleError;
      setCouple(coupleRow as Couple);
      setAnniversaryDate(coupleRow?.anniversary_date ?? null);
    } catch (err: any) {
      setError(err.message ?? "Errore durante il join della coppia.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSaveAnniversary(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !anniversaryDate) return;

    setSavingAnniversary(true);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("couples")
        .update({ anniversary_date: anniversaryDate })
        .eq("id", couple.id);

      if (updateError) throw updateError;

      setMessage("Data anniversario salvata.");
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio dell'anniversario.");
    } finally {
      setSavingAnniversary(false);
    }
  }

  return (
    <ProtectedPage>
      <div className="space-y-5">
        {/* Header con indietro */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-50">
              Profilo &amp; Partner
            </h1>
            <p className="text-xs text-slate-400">
              Gestisci i tuoi dati e la coppia.
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-slate-300">Caricamento...</p>
        )}

        {!loading && (
          <>
            {/* Profilo personale */}
            <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Dati personali
              </h2>
              <form onSubmit={handleSaveProfile} className="space-y-3">
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

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full rounded-xl bg-pink-500 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
                >
                  {savingProfile ? "Salvataggio..." : "Salva profilo"}
                </button>
              </form>
            </section>

            {/* Stato coppia */}
            <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/70 p-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Coppia &amp; partner
              </h2>

              <div className="space-y-1 text-xs text-slate-300">
                {couple ? (
                  <>
                    <p>
                      Coppia:{" "}
                      <span className="font-medium text-slate-50">
                        {couple.name || "Coppia senza nome"}
                      </span>
                    </p>
                    <p>Membri collegati: {memberCount}</p>
                    {memberCount >= 2 && (
                      <p className="text-emerald-300">
                        Il tuo partner risulta già collegato.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Ancora nessuna coppia associata al tuo account. Creane una o
                    unisciti con un codice invito.
                  </p>
                )}
              </div>

              {/* Data anniversario se esiste una coppia */}
              {couple && (
                <form
                  onSubmit={handleSaveAnniversary}
                  className="space-y-2 rounded-xl bg-slate-950/70 p-3"
                >
                  <p className="text-xs font-medium text-slate-200">
                    Data anniversario
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={anniversaryDate ?? ""}
                      onChange={(e) =>
                        setAnniversaryDate(e.target.value || null)
                      }
                      className="flex-1 rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500/70"
                    />
                    <button
                      type="submit"
                      disabled={savingAnniversary || !anniversaryDate}
                      className="rounded-xl bg-pink-500 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-400 disabled:opacity-60"
                    >
                      {savingAnniversary ? "Salvo..." : "Salva"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Questa data viene usata nella home per il conteggio dei giorni
                    insieme.
                  </p>
                </form>
              )}

              {/* Crea coppia se non esiste */}
              {!couple && (
                <form
                  onSubmit={handleCreateCouple}
                  className="space-y-3 rounded-xl bg-slate-950/70 p-3"
                >
                  <p className="text-xs font-medium text-slate-200">
                    Crea una nuova coppia
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">
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
              )}

              {/* Invita partner se ho già una coppia */}
              {couple && (
                <form
                  onSubmit={handleInvitePartner}
                  className="space-y-3 rounded-xl bg-slate-950/70 p-3"
                >
                  <p className="text-xs font-medium text-slate-200">
                    Invita il tuo partner
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">
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

                  {lastInvite && (
                    <div className="mt-2 rounded-xl bg-slate-900/80 p-2 text-[11px] text-slate-200">
                      <p className="font-semibold text-slate-50">Ultimo invito</p>
                      <p className="mt-1">
                        Email partner:{" "}
                        <span className="font-medium">
                          {lastInvite.invited_email}
                        </span>
                      </p>
                      <p className="mt-1">
                        Codice invito:{" "}
                        <span className="font-mono text-pink-300">
                          {lastInvite.code}
                        </span>
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Condividi questo codice con il tuo partner: dovrà inserirlo
                        nella sezione &quot;Ho un codice invito&quot; dopo essersi
                        registrato.
                      </p>
                    </div>
                  )}
                </form>
              )}

              {/* Join tramite codice */}
              <form
                onSubmit={handleJoinByCode}
                className="space-y-3 rounded-xl bg-slate-950/70 p-3"
              >
                <p className="text-xs font-medium text-slate-200">
                  Ho un codice invito
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">
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
