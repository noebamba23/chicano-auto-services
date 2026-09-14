"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyWhatsAppPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const res = await fetch("/api/auth/whatsapp/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Code incorrect.");
          setLoading(false);
          return;
        }

        router.push(data.redirectTo ?? "/espace-client");
      } catch {
        setError("Impossible de contacter le serveur.");
        setLoading(false);
      }
    },
    [code, router]
  );

  async function onResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/whatsapp/resend-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de renvoyer un code pour le moment.");
      } else {
        setInfo("Un nouveau code vient d'être envoyé sur votre WhatsApp.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-chicano-black px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-chicano-black-soft p-8">
        <h1 className="text-2xl font-bold text-chicano-white">Vérifiez votre numéro WhatsApp</h1>
        <p className="mt-2 text-sm text-chicano-gray-light/70">
          Nous vous avons envoyé un code de vérification sur WhatsApp pour sécuriser votre connexion.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-chicano-white">
              Code CHICANO
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-center text-lg tracking-[0.4em] text-chicano-white placeholder:text-chicano-gray-light/30 focus:border-chicano-red focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-chicano-red-bright">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="min-h-11 w-full rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-chicano-red-dark disabled:opacity-60"
          >
            {loading ? "Vérification..." : "SE CONNECTER"}
          </button>
        </form>

        <button
          onClick={onResend}
          disabled={resending || cooldown > 0}
          className="mt-4 min-h-11 w-full text-center text-sm font-medium text-chicano-red-bright disabled:text-chicano-gray-light/40"
        >
          {cooldown > 0 ? `Renvoyer un code (${cooldown}s)` : "Je n'ai pas reçu de code — Renvoyer"}
        </button>
      </div>
    </main>
  );
}
