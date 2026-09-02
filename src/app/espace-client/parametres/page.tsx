import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getConsent } from "@/lib/crm/consent";
import { ConsentForm } from "@/components/account/consent-form";

export default async function ClientSettingsPage() {
  const session = await getSession();
  const customerId = session ? await getCustomerIdForUser(session.sub) : null;
  const consent = customerId ? await getConsent(customerId) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Paramètres</h1>

      <div className="mt-6">
        {consent && <ConsentForm initial={consent} />}
      </div>
    </div>
  );
}
