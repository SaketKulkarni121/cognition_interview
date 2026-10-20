import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { UnauthenticatedError } from "../errors";
import { isRole, type SessionUser } from "./permissions";

/**
 * SIMULATED AUTHENTICATION.
 * The signed-in user is identified by a plain cookie holding a user id chosen on
 * the /login page. There are no passwords and the cookie is not signed. Replace
 * this module with a real identity provider (SSO/OIDC) before any real use.
 */
export const SESSION_COOKIE = "ops_sim_user";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !isRole(user.role)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}
