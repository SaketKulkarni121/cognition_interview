import { describe, expect, it } from "vitest";
import { assertCan, can } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/errors";

describe("role permissions", () => {
  it("lets every role read KYC applications", () => {
    for (const role of ["ADMIN", "ANALYST", "VIEWER"] as const) expect(can({ role }, "kyc:read")).toBe(true);
  });

  it("only lets Admins and Analysts make decisions and add notes", () => {
    expect(can({ role: "ADMIN" }, "kyc:decide")).toBe(true);
    expect(can({ role: "ANALYST" }, "kyc:decide")).toBe(true);
    expect(can({ role: "VIEWER" }, "kyc:decide")).toBe(false);
    expect(can({ role: "VIEWER" }, "kyc:note")).toBe(false);
  });

  it("reserves escalated decisions and assigning others to Admins", () => {
    expect(can({ role: "ADMIN" }, "kyc:decide:escalated")).toBe(true);
    expect(can({ role: "ANALYST" }, "kyc:decide:escalated")).toBe(false);
    expect(can({ role: "ANALYST" }, "kyc:assign:any")).toBe(false);
  });

  it("restricts the audit log to Admins and Viewers", () => {
    expect(can({ role: "ADMIN" }, "audit:read")).toBe(true);
    expect(can({ role: "VIEWER" }, "audit:read")).toBe(true);
    expect(can({ role: "ANALYST" }, "audit:read")).toBe(false);
  });

  it("denies everything when there is no user", () => {
    expect(can(null, "kyc:read")).toBe(false);
    expect(() => assertCan(undefined, "kyc:read")).toThrow(ForbiddenError);
  });
});
