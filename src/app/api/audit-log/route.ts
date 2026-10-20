import { apiHandler } from "@/lib/api";
import { assertCan } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { listAuditLog } from "@/lib/audit";

// GET /api/audit-log?module=&action=&q=&page=
export const GET = apiHandler(async ({ req, user }) => {
  assertCan(user, "audit:read");
  const sp = new URL(req.url).searchParams;
  return listAuditLog(db, {
    module: sp.get("module") ?? undefined,
    action: sp.get("action") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: Number(sp.get("page") ?? 1) || 1,
  });
});
