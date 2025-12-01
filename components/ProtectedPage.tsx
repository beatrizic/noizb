"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type ProtectedPageProps = {
  children: ReactNode;
};

export function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          console.error("Errore getSession:", error.message);
        }

        const session = data?.session;

        if (!session) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      } catch (err) {
        console.error("Errore inatteso getSession:", err);
        router.replace("/login");
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-300">Caricamento...</p>
      </div>
    );
  }

  return <>{children}</>;
}
