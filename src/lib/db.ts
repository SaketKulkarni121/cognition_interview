import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Vercel demo deployments: the seeded SQLite file is built into the bundle
 * (see `vercel-build`), but the bundle is read-only, so copy it to /tmp on
 * cold start. Data is per-instance and resets on each cold start.
 */
function vercelDatabaseUrl() {
  if (!process.env.VERCEL) return undefined;
  const bundled = path.join(process.cwd(), "prisma", "dev.db");
  const writable = "/tmp/ops-platform.db";
  if (!fs.existsSync(writable) && fs.existsSync(bundled)) fs.copyFileSync(bundled, writable);
  process.env.DATABASE_URL = `file:${writable}`;
  return process.env.DATABASE_URL;
}

function createClient() {
  const url = vercelDatabaseUrl();
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
export type DbClient = typeof db | Tx;
