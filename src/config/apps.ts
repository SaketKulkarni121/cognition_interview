import { ClipboardCheck, LayoutGrid, ScrollText, Scale, Banknote, Receipt, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Registry of internal applications. The sidebar and home page are generated
 * from this list, so adding a new tool is: build its module + pages, register
 * its permissions, and add an entry here.
 */
export type InternalApp = {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  status: "live" | "coming-soon";
};

export const INTERNAL_APPS: InternalApp[] = [
  { id: "home", name: "Home", description: "Overview of internal tools", href: "/", icon: LayoutGrid, status: "live" },
  {
    id: "kyc",
    name: "KYC Review",
    description: "Review new customer identity applications and record decisions.",
    href: "/kyc",
    icon: ClipboardCheck,
    permission: "kyc:read",
    status: "live",
  },
  {
    id: "refunds",
    name: "Refunds",
    description: "Investigate customer refund requests and approve, reject, or escalate them.",
    href: "/refunds",
    icon: Receipt,
    permission: "refunds:read",
    status: "live",
  },
  {
    id: "audit",
    name: "Audit Log",
    description: "Every decision and change, with who made it, when, and why.",
    href: "/audit",
    icon: ScrollText,
    permission: "audit:read",
    status: "live",
  },
  { id: "disputes", name: "Disputes", description: "Card dispute case management.", href: "#", icon: Scale, status: "coming-soon" },
  { id: "payouts", name: "Payout Holds", description: "Review held merchant payouts.", href: "#", icon: Banknote, status: "coming-soon" },
];
