import { NextRequest } from "next/server";
import { isAppUnlocked } from "@/lib/authLock";

export const dynamic = "force-dynamic";

// GET -> { unlocked } (kilit ekranı + profil kartı durumu)
export async function GET(req: NextRequest) {
  const unlocked = await isAppUnlocked(req.cookies.get("yd_app")?.value);
  return Response.json({ unlocked });
}
