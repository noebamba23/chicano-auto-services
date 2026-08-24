import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Non authentifié.", 401);

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneE164: true,
      role: true,
      status: true,
      whatsappVerified: true,
    },
  });

  if (!user) return jsonError("Utilisateur introuvable.", 404);

  return NextResponse.json({ user });
}
