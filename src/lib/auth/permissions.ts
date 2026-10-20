import { ForbiddenError } from "../errors";

export const ROLES = ["ADMIN", "ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string | null;
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ANALYST: "Analyst",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full access. Assigns work and makes the final call on escalated cases.",
  ANALYST: "Reviews KYC applications and refund requests and records decisions.",
  VIEWER: "Read-only access to cases and the audit log.",
};

/**
 * Central permission table. Every internal app registers its permissions here
 * so authorization is declared in one place and enforced server-side.
 */
const PERMISSIONS = {
  "kyc:read": ["ADMIN", "ANALYST", "VIEWER"],
  "kyc:assign:self": ["ADMIN", "ANALYST"],
  "kyc:assign:any": ["ADMIN"],
  "kyc:decide": ["ADMIN", "ANALYST"],
  "kyc:decide:escalated": ["ADMIN"],
  "kyc:decide:unassigned": ["ADMIN"],
  "kyc:note": ["ADMIN", "ANALYST"],
  "refunds:read": ["ADMIN", "ANALYST", "VIEWER"],
  "refunds:decide": ["ADMIN", "ANALYST"],
  "refunds:decide:escalated": ["ADMIN"],
  "refunds:note": ["ADMIN", "ANALYST"],
  "refunds:payment:retry": ["ADMIN"],
  "audit:read": ["ADMIN", "VIEWER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(user: Pick<SessionUser, "role"> | null | undefined, permission: Permission) {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

export function assertCan(
  user: Pick<SessionUser, "role"> | null | undefined,
  permission: Permission,
  message?: string,
) {
  if (!can(user, permission)) throw new ForbiddenError(message);
}
