"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      acceptedTerms: form.get("acceptedTerms") === "on",
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo ?? "/verification-whatsapp");
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-chicano-gray-light px-4 py-16">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-chicano-red">
          CHICANO AUTO SERVICES
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-chicano-black">Créer mon compte CHICANO</h1>
        <p className="mt-1 text-sm text-chicano-gray">
          Votre numéro WhatsApp est votre identifiant principal.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-chicano-black">
                Prénom
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                className="mt-1 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm focus:border-chicano-red focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-chicano-black">
                Nom
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                className="mt-1 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm focus:border-chicano-red focus:outline-none"
              />
            </div>
          </div>

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
            <label htmlFor="email" className="block text-sm font-medium text-chicano-black">
              Email <span className="font-normal text-chicano-gray">(optionnel)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
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
              minLength={8}
              required
              className="mt-1 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm focus:border-chicano-red focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-chicano-gray">
            <input type="checkbox" name="acceptedTerms" required className="mt-1" />
            J&apos;accepte les conditions d&apos;utilisation de CHICANO AUTO SERVICES.
          </label>

          {error && <p className="text-sm text-chicano-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-chicano-red-dark disabled:opacity-60"
          >
            {loading ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-chicano-gray">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-semibold text-chicano-red">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
