import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/auth/session";

// SIMULATED AUTH: "signing in" just stores the chosen user id in a cookie.

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user, simulated: true });
}

export async function POST(req: Request) {
  try {
    const { userId } = await parseBody(req, z.object({ userId: z.string().min(1) }));
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");
    const res = NextResponse.json({ user: { id: user.id, name: user.name, role: user.role }, simulated: true });
    res.cookies.set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
