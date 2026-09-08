import { db, hasDb } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { users, conversations } from "@/db/schema";
import { getPrimaryUser } from "@/lib/data";
import { ensureContent } from "@/lib/seed";
import { freeTalkReply } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  await ensureContent();
  const topic = body.topic || "daily";
  const history = (body.history || []).slice(-8);
  const aiReply = await freeTalkReply(topic, body.message || "", history);
  if (!hasDb || !db) return Response.json({ reply: aiReply }); // FIX demo mode
  const user = await getPrimaryUser();
  await db.insert(conversations).values({ userId: user.id, role: "user", message: body.message || "" });
  await db.insert(conversations).values({ userId: user.id, role: "ai", message: aiReply });
  const u = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (u[0]) {
    await db.update(users).set({ sentences: (u[0].sentences || 0) + 1 }).where(eq(users.id, user.id));
  }
  return Response.json({ reply: aiReply });
}
