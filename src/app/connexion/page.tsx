"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Numéro ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo ?? "/espace-client");
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-chicano-black px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-chicano-black-soft p-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/chicano-logo.png"
            alt="CHICANO AUTO SERVICES"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="text-sm font-bold tracking-wide text-chicano-white">CHICANO AUTO SERVICES</span>
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-chicano-white">Connexion à votre espace</h1>
        <p className="mt-2 text-sm text-chicano-gray-light/70">
          Accédez à votre espace CHICANO avec votre numéro WhatsApp.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-chicano-white">
              Numéro WhatsApp
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+223 XX XX XX XX"
              required
              className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5 text-sm text-chicano-white placeholder:text-chicano-gray-light/40 focus:border-chicano-red focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-chicano-white">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5 text-sm text-chicano-white focus:border-chicano-red focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-chicano-red-bright">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-chicano-red-dark disabled:opacity-60"
          >
            {loading ? "Connexion..." : "CONTINUER"}
          </button>
        </form>

        <p className="mt-5 text-xs text-chicano-gray-light/50">
          Votre numéro WhatsApp permet de sécuriser l&apos;accès à votre compte CHICANO.
        </p>

        <p className="mt-6 text-center text-sm text-chicano-gray-light/70">
          Vous n&apos;avez pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-chicano-red-bright">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
