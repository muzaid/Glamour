import { NextResponse } from "next/server";
import { DEMO_USERS } from "@glamotion/core";
import { DEMO_MODE, secret } from "@/server/runtime";
import { signSession, SESSION_COOKIE } from "@/server/session";

/** Demo identity switcher (no passwords). Disabled outside demo mode; real auth is Supabase (ticket F-005). */
export async function POST(req: Request) {
  if (!DEMO_MODE) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found", requestId: "", details: {} } }, { status: 404 });
  const form = await req.formData();
  const key = String(form.get("user") ?? "");
  const next = String(form.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  if (key === "signout") { res.cookies.delete(SESSION_COOKIE); return res; }
  const u = DEMO_USERS[key as keyof typeof DEMO_USERS];
  if (!u) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Unknown demo user", requestId: "", details: {} } }, { status: 400 });
  res.cookies.set(SESSION_COOKIE, signSession(u.id, secret("GLAMOTION_SESSION_SECRET")), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}
