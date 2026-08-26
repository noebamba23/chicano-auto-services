import { listTechnicians } from "@/lib/technicians/service";

const SKILL_LABELS: Record<string, string> = {
  MECHANICAL: "Mécanique",
  DIAGNOSTIC: "Diagnostic",
  ELECTRICAL: "Électricité",
  ELECTRONICS: "Électronique",
  HYBRID: "Hybride",
  EV: "Véhicule électrique",
  KEY_PROGRAMMING: "Programmation clé",
};

export default async function ProductionTechniciansPage() {
  const technicians = await listTechnicians();

  return (
    <div>
      <h1 className="text-2xl font-bold">Techniciens</h1>
      <p className="mt-1 text-sm text-white/60">
        {technicians.length} technicien(s) — suivi de disponibilité en lecture seule ; l&apos;affectation,
        le départ/arrivée sur site et le diagnostic se pilotent depuis la fiche demande et l&apos;espace
        technicien.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {technicians.map((t) => (
          <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="font-semibold">
              {t.user.firstName} {t.user.lastName}
            </p>
            <p className="text-xs text-white/50">{t.user.phoneE164}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.skills.map((s) => (
                <span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  {SKILL_LABELS[s] ?? s}
                </span>
              ))}
            </div>
            <p className={`mt-3 text-xs ${t.isAvailable ? "text-emerald-400" : "text-white/40"}`}>
              {t.isAvailable ? "● Disponible" : "○ Indisponible"}
            </p>
          </div>
        ))}
        {technicians.length === 0 && <p className="text-sm text-white/50">Aucun technicien enregistré.</p>}
      </div>
    </div>
  );
}
