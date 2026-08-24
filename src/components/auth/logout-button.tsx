"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="text-sm font-medium text-chicano-gray hover:text-chicano-red disabled:opacity-60"
    >
      Déconnexion
    </button>
  );
}
