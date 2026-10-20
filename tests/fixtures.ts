import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/auth/permissions";
import type { KycStatus } from "@/modules/kyc/workflow";

export async function resetDb() {
  await db.auditLog.deleteMany();
  await db.kycDecision.deleteMany();
  await db.kycNote.deleteMany();
  await db.kycDocument.deleteMany();
  await db.kycApplication.deleteMany();
  await db.user.deleteMany();
}

async function user(name: string, role: Role): Promise<SessionUser> {
  const u = await db.user.create({ data: { name, role, email: `${name.toLowerCase().replace(/\s/g, ".")}@test.local` } });
  return { id: u.id, name: u.name, email: u.email, role };
}

export async function createUsers() {
  return {
    admin: await user("Ada Admin", "ADMIN"),
    analyst: await user("Andy Analyst", "ANALYST"),
    otherAnalyst: await user("Olive Analyst", "ANALYST"),
    viewer: await user("Vic Viewer", "VIEWER"),
  };
}

let seq = 0;
export async function createApplication(opts: { status?: KycStatus; assignedReviewerId?: string | null } = {}) {
  seq += 1;
  return db.kycApplication.create({
    data: {
      reference: `KYC-T${seq}`,
      status: opts.status ?? "SUBMITTED",
      assignedReviewerId: opts.assignedReviewerId ?? null,
      firstName: "Test",
      lastName: `Customer${seq}`,
      email: `customer${seq}@mail.example`,
      phone: "+1 555 0100",
      dateOfBirth: new Date("1990-01-01"),
      nationality: "Testland",
      addressLine1: "1 Test St",
      city: "Testville",
      region: "TS",
      postalCode: "00000",
      country: "Testland",
      occupation: "Tester",
      sourceOfFunds: "Salary",
      expectedMonthlyVolume: "$1,000 – $2,000",
      accountPurpose: "Testing",
      taxIdLast4: "1234",
    },
  });
}
