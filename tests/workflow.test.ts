import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/permissions";
import { KYC_ACTIONS, KYC_STATUSES, checkAction, checkAssign, nextStatus, statusAfterAssign } from "@/modules/kyc/workflow";

const admin: SessionUser = { id: "admin", name: "Admin", email: "a@x", role: "ADMIN" };
const analyst: SessionUser = { id: "analyst", name: "Analyst", email: "b@x", role: "ANALYST" };
const viewer: SessionUser = { id: "viewer", name: "Viewer", email: "c@x", role: "VIEWER" };

describe("state machine", () => {
  it("allows the expected transitions", () => {
    expect(nextStatus("IN_REVIEW", "APPROVE")).toBe("APPROVED");
    expect(nextStatus("IN_REVIEW", "REJECT")).toBe("REJECTED");
    expect(nextStatus("IN_REVIEW", "REQUEST_INFO")).toBe("INFO_REQUESTED");
    expect(nextStatus("IN_REVIEW", "ESCALATE")).toBe("ESCALATED");
    expect(nextStatus("INFO_REQUESTED", "RESUME_REVIEW")).toBe("IN_REVIEW");
    expect(nextStatus("ESCALATED", "APPROVE")).toBe("APPROVED");
  });

  it("never allows leaving a terminal status", () => {
    for (const from of ["APPROVED", "REJECTED"] as const)
      for (const action of KYC_ACTIONS) expect(nextStatus(from, action)).toBeNull();
  });

  it("does not allow deciding an application nobody has started reviewing", () => {
    for (const action of KYC_ACTIONS) expect(nextStatus("SUBMITTED", action)).toBeNull();
  });

  it("does not allow approving while waiting on the customer", () => {
    expect(nextStatus("INFO_REQUESTED", "APPROVE")).toBeNull();
  });

  it("every transition target is a known status", () => {
    for (const from of KYC_STATUSES)
      for (const action of KYC_ACTIONS) {
        const to = nextStatus(from, action);
        if (to) expect(KYC_STATUSES).toContain(to);
      }
  });
});

describe("checkAction (role + assignment rules)", () => {
  const mine = { status: "IN_REVIEW", assignedReviewerId: "analyst" };
  const theirs = { status: "IN_REVIEW", assignedReviewerId: "someone-else" };

  it("lets the assigned analyst approve", () => {
    expect(checkAction(analyst, mine, "APPROVE").allowed).toBe(true);
  });
  it("blocks analysts from deciding applications assigned to others", () => {
    expect(checkAction(analyst, theirs, "APPROVE").allowed).toBe(false);
  });
  it("lets admins decide any open application", () => {
    expect(checkAction(admin, theirs, "REJECT").allowed).toBe(true);
  });
  it("blocks viewers from every action", () => {
    for (const a of KYC_ACTIONS) expect(checkAction(viewer, mine, a).allowed).toBe(false);
  });
  it("only admins can decide escalated applications", () => {
    const escalated = { status: "ESCALATED", assignedReviewerId: "analyst" };
    expect(checkAction(analyst, escalated, "APPROVE")).toMatchObject({ allowed: false, reason: expect.stringContaining("Admin") });
    expect(checkAction(admin, escalated, "APPROVE").allowed).toBe(true);
  });
  it("explains why an action is unavailable", () => {
    expect(checkAction(admin, { status: "APPROVED", assignedReviewerId: null }, "REJECT").reason).toMatch(/already approved/);
  });
});

describe("checkAssign", () => {
  it("lets analysts claim unassigned applications but not reassign others", () => {
    expect(checkAssign(analyst, { status: "SUBMITTED", assignedReviewerId: null }, "analyst").allowed).toBe(true);
    expect(checkAssign(analyst, { status: "SUBMITTED", assignedReviewerId: null }, "someone-else").allowed).toBe(false);
    expect(checkAssign(analyst, { status: "IN_REVIEW", assignedReviewerId: "someone-else" }, "analyst").allowed).toBe(false);
  });
  it("lets admins assign anyone; viewers no one", () => {
    expect(checkAssign(admin, { status: "IN_REVIEW", assignedReviewerId: "x" }, "y").allowed).toBe(true);
    expect(checkAssign(viewer, { status: "SUBMITTED", assignedReviewerId: null }, "viewer").allowed).toBe(false);
  });
  it("does not allow reassigning closed applications", () => {
    expect(checkAssign(admin, { status: "APPROVED", assignedReviewerId: "x" }, "y").allowed).toBe(false);
  });
  it("moves new applications into review when assigned and back when unassigned", () => {
    expect(statusAfterAssign("SUBMITTED", "x")).toBe("IN_REVIEW");
    expect(statusAfterAssign("IN_REVIEW", null)).toBe("SUBMITTED");
    expect(statusAfterAssign("ESCALATED", "x")).toBe("ESCALATED");
  });
});
