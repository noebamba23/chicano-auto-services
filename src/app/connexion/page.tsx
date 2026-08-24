"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <main className="flex min-h-screen items-center justify-center bg-chicano-gray-light px-4 py-16">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-chicano-red">
          CHICANO AUTO SERVICES
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-chicano-black">Connexion</h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-chicano-black">
              Numéro WhatsApp
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+223 70 00 00 00"
              required
              className="mt-1 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm focus:border-chicano-red focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-chicano-black">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm focus:border-chicano-red focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-chicano-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-chicano-red-dark disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-chicano-gray">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-chicano-red">
            Créer mon compte
          </Link>
        </p>
      </div>
    </main>
  );
}
