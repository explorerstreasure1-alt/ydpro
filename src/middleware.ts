import { NextRequest, NextResponse } from "next/server";

// API koruması — kilit kapalıyken Groq/ElevenLabs kotası yenmez.
// Kilit ve şifre ekranları her zaman erişilebilir. İmza denetimi route'larda.
const OPEN = ["/api/tts/unlock", "/api/auth"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/")) return NextResponse.next();
  if (OPEN.some((p) => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  // /api/tts durum sorgusu (GET) serbest — istemci kilit halini öğrenir
  if (path === "/api/tts" && req.method === "GET") return NextResponse.next();
  const hasCookie = !!req.cookies.get("yd_app")?.value;
  if (!hasCookie) return Response.json({ error: "locked" }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
