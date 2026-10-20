/**
 * Seeds the database with realistic but ENTIRELY FICTIONAL data.
 * Names, addresses, document numbers and companies are invented.
 */
import { PrismaClient } from "@prisma/client";
import { seedFlags } from "./seed-flags";
import { seedRefunds } from "./seed-refunds";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);

const users = [
  { key: "admin", name: "Priya Raman", email: "priya.raman@example-fintech.test", role: "ADMIN", title: "KYC Operations Lead" },
  { key: "marcus", name: "Marcus Chen", email: "marcus.chen@example-fintech.test", role: "ANALYST", title: "KYC Analyst" },
  { key: "elena", name: "Elena Novak", email: "elena.novak@example-fintech.test", role: "ANALYST", title: "Senior KYC Analyst" },
  { key: "jordan", name: "Jordan Ellis", email: "jordan.ellis@example-fintech.test", role: "ANALYST", title: "KYC Analyst" },
  { key: "sam", name: "Sam Okafor", email: "sam.okafor@example-fintech.test", role: "VIEWER", title: "Compliance Auditor" },
] as const;
type UserKey = (typeof users)[number]["key"];

type Step =
  | { kind: "assign"; by: UserKey; to: UserKey; at: number }
  | { kind: "note"; by: UserKey; body: string; at: number }
  | { kind: "decide"; by: UserKey; action: string; reason: string; at: number };

type Seed = {
  first: string; last: string; dob: string; nationality: string;
  address: [string, string | null, string, string, string, string];
  occupation: string; employer: string | null; funds: string; volume: string; purpose: string;
  docs: ("PASSPORT" | "DRIVERS_LICENSE" | "NATIONAL_ID" | "PROOF_OF_ADDRESS")[];
  submitted: number; steps: Step[]; expiredDoc?: boolean;
};

const D = (n: number) => n * DAY;
const H = (n: number) => n * HOUR;

const apps: Seed[] = [
  { first: "Amelia", last: "Hartwell", dob: "1991-04-12", nationality: "United States", address: ["418 Juniper Lane", "Apt 3B", "Portland", "OR", "97205", "United States"], occupation: "Product Designer", employer: "Lumen Studio LLC", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Everyday spending and savings", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: H(3), steps: [] },
  { first: "Rafael", last: "Moreno Díaz", dob: "1986-09-30", nationality: "Spain", address: ["Calle de las Flores 22", "3º Izq.", "Valencia", "Valencia", "46001", "Spain"], occupation: "Restaurant Owner", employer: "Casa Moreno S.L.", funds: "Business income", volume: "$10,000 – $25,000", purpose: "Receiving supplier refunds and paying staff", docs: ["NATIONAL_ID", "PROOF_OF_ADDRESS"], submitted: H(7), steps: [] },
  { first: "Grace", last: "Adeyemi", dob: "1995-01-22", nationality: "United Kingdom", address: ["17 Kestrel Road", null, "Leeds", "West Yorkshire", "LS6 2QT", "United Kingdom"], occupation: "Nurse", employer: "Northgate Community Clinic", funds: "Salary", volume: "$1,000 – $2,000", purpose: "Salary deposits and bill payments", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: H(20), steps: [] },
  { first: "Tomasz", last: "Wiśniewski", dob: "1979-06-05", nationality: "Poland", address: ["ul. Ogrodowa 8/14", null, "Kraków", "Lesser Poland", "31-155", "Poland"], occupation: "Software Contractor", employer: null, funds: "Freelance income", volume: "$5,000 – $10,000", purpose: "Invoicing international clients", docs: ["PASSPORT"], submitted: D(1) + H(4), steps: [] },
  { first: "Hana", last: "Kobayashi", dob: "1998-11-18", nationality: "Japan", address: ["2-14-7 Sakuragaoka", "Room 502", "Shibuya", "Tokyo", "150-0031", "Japan"], occupation: "Graduate Student", employer: "Meisei Institute of Technology", funds: "Scholarship and family support", volume: "Under $1,000", purpose: "Tuition and living expenses", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(1) + H(9), steps: [] },

  { first: "Daniel", last: "Okonkwo", dob: "1988-03-14", nationality: "Canada", address: ["90 Maple Crescent", null, "Toronto", "ON", "M4C 1B5", "Canada"], occupation: "Civil Engineer", employer: "Brightline Infrastructure Inc.", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Savings and international transfers to family", docs: ["DRIVERS_LICENSE", "PROOF_OF_ADDRESS"], submitted: D(2), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(1) + H(20) }, { kind: "note", by: "marcus", body: "Driver's license and utility bill both show the Maple Crescent address. Checking the employer name against the stated occupation next.", at: D(1) + H(18) }] },
  { first: "Sofia", last: "Lindqvist", dob: "1993-07-08", nationality: "Sweden", address: ["Södra Vägen 41", null, "Gothenburg", "Västra Götaland", "412 54", "Sweden"], occupation: "Marketing Manager", employer: "Fjord Retail AB", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Everyday spending", docs: ["NATIONAL_ID", "PROOF_OF_ADDRESS"], submitted: D(2) + H(6), steps: [{ kind: "assign", by: "admin", to: "elena", at: D(2) }] },
  { first: "Mateo", last: "Fernández", dob: "1990-12-02", nationality: "Argentina", address: ["Av. Santa Fe 1840", "Piso 6 B", "Buenos Aires", "CABA", "C1123", "Argentina"], occupation: "Import/Export Broker", employer: "Río Plata Trading S.A.", funds: "Business income", volume: "$25,000 – $50,000", purpose: "Paying overseas suppliers", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(3), steps: [{ kind: "assign", by: "jordan", to: "jordan", at: D(2) + H(22) }] },
  { first: "Aisha", last: "Rahman", dob: "1997-05-27", nationality: "Bangladesh", address: ["55 Willow Court", "Unit 12", "Jersey City", "NJ", "07302", "United States"], occupation: "Data Analyst", employer: "Harborview Insurance Co.", funds: "Salary", volume: "$1,000 – $2,000", purpose: "Remittances and savings", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(3) + H(5), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(3) }] },

  { first: "Lukas", last: "Becker", dob: "1984-02-19", nationality: "Germany", address: ["Lindenstraße 77", null, "Hamburg", "Hamburg", "20095", "Germany"], occupation: "Architect", employer: "Becker & Vogt Architekten", funds: "Salary and rental income", volume: "$5,000 – $10,000", purpose: "Managing rental property payments", docs: ["NATIONAL_ID", "PROOF_OF_ADDRESS"], submitted: D(5), expiredDoc: true, steps: [{ kind: "assign", by: "elena", to: "elena", at: D(4) + H(20) }, { kind: "decide", by: "elena", action: "REQUEST_INFO", reason: "The national ID card expired last year. Requested a currently valid ID (passport or renewed ID card) before continuing.", at: D(4) + H(18) }] },
  { first: "Chloé", last: "Dubois", dob: "1992-08-11", nationality: "France", address: ["14 Rue des Tanneurs", null, "Lyon", "Auvergne-Rhône-Alpes", "69002", "France"], occupation: "Pharmacist", employer: "Pharmacie du Rhône", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Everyday spending and savings", docs: ["PASSPORT"], submitted: D(6), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(5) + H(22) }, { kind: "decide", by: "marcus", action: "REQUEST_INFO", reason: "No proof of address was uploaded. Asked the customer for a utility bill or bank statement from the last 3 months.", at: D(5) + H(21) }] },
  { first: "Kwame", last: "Mensah", dob: "1987-10-03", nationality: "Ghana", address: ["22 Palm Avenue", null, "Accra", "Greater Accra", "GA-104", "Ghana"], occupation: "Cocoa Exporter", employer: "Golden Pod Exports Ltd.", funds: "Business income", volume: "$50,000+", purpose: "Receiving international trade payments", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(7), steps: [{ kind: "assign", by: "jordan", to: "jordan", at: D(6) + H(20) }, { kind: "note", by: "jordan", body: "High expected monthly volume for a new account. Documents look consistent; asking for clarification on the trading company ownership.", at: D(6) + H(10) }, { kind: "decide", by: "jordan", action: "ESCALATE", reason: "Expected monthly volume is above $50k and the business ownership structure is not clear from the submission. Requesting senior review.", at: D(6) + H(9) }] },
  { first: "Isabella", last: "Rossi", dob: "1983-04-25", nationality: "Italy", address: ["Via Garibaldi 9", "Scala B", "Turin", "Piedmont", "10122", "Italy"], occupation: "Art Dealer", employer: "Galleria Rossi", funds: "Sale of artwork", volume: "$25,000 – $50,000", purpose: "Receiving payments from collectors", docs: ["NATIONAL_ID", "PROOF_OF_ADDRESS"], submitted: D(8), steps: [{ kind: "assign", by: "elena", to: "elena", at: D(7) + H(20) }, { kind: "decide", by: "elena", action: "ESCALATE", reason: "Art sales with irregular, high-value incoming payments. The policy says this sector needs an Admin sign-off.", at: D(7) + H(15) }] },

  { first: "Noah", last: "Patel", dob: "1994-09-09", nationality: "United States", address: ["1207 Cedar Street", null, "Austin", "TX", "78702", "United States"], occupation: "Teacher", employer: "Eastside Unified School District", funds: "Salary", volume: "$1,000 – $2,000", purpose: "Salary deposits", docs: ["DRIVERS_LICENSE", "PROOF_OF_ADDRESS"], submitted: D(9), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(8) + H(22) }, { kind: "note", by: "marcus", body: "License photo and details are clear. Address on the utility bill matches the application.", at: D(8) + H(21) }, { kind: "decide", by: "marcus", action: "APPROVE", reason: "Driver's license is valid and matches the applicant's name and date of birth. Proof of address is recent and matches. Low expected volume consistent with occupation.", at: D(8) + H(20) }] },
  { first: "Mei", last: "Lin", dob: "1990-02-14", nationality: "Singapore", address: ["38 Orchard Rise", "#12-04", "Singapore", "Central", "238880", "Singapore"], occupation: "Financial Analyst", employer: "Straits Capital Partners", funds: "Salary and investments", volume: "$5,000 – $10,000", purpose: "Investing and savings", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(10), steps: [{ kind: "assign", by: "elena", to: "elena", at: D(9) + H(22) }, { kind: "decide", by: "elena", action: "APPROVE", reason: "Passport valid until 2031, details consistent with the profile. Utility bill confirms address. No concerns.", at: D(9) + H(19) }] },
  { first: "Oliver", last: "Brennan", dob: "1981-12-30", nationality: "Ireland", address: ["6 Harbour View", null, "Galway", "Connacht", "H91 X2Y3", "Ireland"], occupation: "Fishing Vessel Owner", employer: "Brennan Marine Ltd.", funds: "Business income", volume: "$10,000 – $25,000", purpose: "Business operating account", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(12), steps: [{ kind: "assign", by: "jordan", to: "jordan", at: D(11) + H(20) }, { kind: "decide", by: "jordan", action: "ESCALATE", reason: "Business account request on a personal application form. Not sure which policy applies.", at: D(11) + H(12) }, { kind: "decide", by: "admin", action: "APPROVE", reason: "Reviewed with the escalation notes. Sole-trader business is acceptable on a personal account under current policy. Documents valid and consistent.", at: D(10) + H(18) }] },
  { first: "Fatima", last: "Al-Sayed", dob: "1996-06-21", nationality: "United Arab Emirates", address: ["Al Wasl Road, Villa 14", null, "Dubai", "Dubai", "00000", "United Arab Emirates"], occupation: "Interior Designer", employer: "Dune & Stone Interiors", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Everyday spending", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(14), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(13) + H(20) }, { kind: "decide", by: "marcus", action: "REQUEST_INFO", reason: "Utility bill is in a family member's name. Asked for a document in the applicant's own name or a tenancy agreement.", at: D(13) + H(18) }, { kind: "decide", by: "marcus", action: "RESUME_REVIEW", reason: "Customer uploaded a tenancy agreement in her own name.", at: D(12) }, { kind: "decide", by: "marcus", action: "APPROVE", reason: "Tenancy agreement confirms address in the applicant's name. Passport valid and details match.", at: D(11) + H(22) }] },

  { first: "Viktor", last: "Hale", dob: "1975-03-03", nationality: "Canada", address: ["PO Box 4410", null, "Vancouver", "BC", "V6B 0A1", "Canada"], occupation: "Consultant", employer: null, funds: "Not specified", volume: "$50,000+", purpose: "Not specified", docs: ["DRIVERS_LICENSE"], submitted: D(16), steps: [{ kind: "assign", by: "jordan", to: "jordan", at: D(15) + H(20) }, { kind: "decide", by: "jordan", action: "REQUEST_INFO", reason: "Address is a PO Box and source of funds is blank. Requested residential proof of address and a description of income.", at: D(15) + H(18) }, { kind: "decide", by: "jordan", action: "REJECT", reason: "Customer did not respond within 10 business days. Residential address and source of funds could not be established.", at: D(1) }] },
  { first: "Elif", last: "Yılmaz", dob: "1989-07-17", nationality: "Turkey", address: ["Bağdat Caddesi 210", "Daire 7", "Istanbul", "Istanbul", "34728", "Turkey"], occupation: "Dentist", employer: "Moda Dental Clinic", funds: "Salary", volume: "$5,000 – $10,000", purpose: "Savings", docs: ["NATIONAL_ID", "PROOF_OF_ADDRESS"], submitted: D(18), steps: [{ kind: "assign", by: "elena", to: "elena", at: D(17) + H(20) }, { kind: "note", by: "elena", body: "Date of birth on the ID differs from the application by one year. Could be a typo — flagging for a second look.", at: D(17) + H(19) }, { kind: "decide", by: "elena", action: "ESCALATE", reason: "Date of birth mismatch between ID and application. Escalating rather than deciding alone.", at: D(17) + H(18) }, { kind: "decide", by: "admin", action: "REJECT", reason: "Customer confirmed the ID belongs to a relative. Identity of the applicant could not be confirmed with the submitted documents.", at: D(16) }] },
  { first: "Benjamin", last: "Clarke", dob: "1999-10-10", nationality: "Australia", address: ["3/45 Bondi Road", null, "Sydney", "NSW", "2026", "Australia"], occupation: "Barista", employer: "Salt & Grind Café", funds: "Salary", volume: "Under $1,000", purpose: "Everyday spending", docs: ["DRIVERS_LICENSE", "PROOF_OF_ADDRESS"], submitted: D(20), steps: [{ kind: "assign", by: "marcus", to: "marcus", at: D(19) + H(22) }, { kind: "decide", by: "marcus", action: "APPROVE", reason: "License valid and matches. Proof of address recent. Low-risk everyday account.", at: D(19) + H(21) }] },
  { first: "Laila", last: "Haddad", dob: "1985-01-29", nationality: "Lebanon", address: ["71 Rue Hamra", "Building C", "Beirut", "Beirut", "1103", "Lebanon"], occupation: "University Lecturer", employer: "Cedar Valley University", funds: "Salary", volume: "$1,000 – $2,000", purpose: "Receiving salary", docs: ["PASSPORT", "PROOF_OF_ADDRESS"], submitted: D(22), steps: [{ kind: "assign", by: "elena", to: "elena", at: D(21) + H(20) }, { kind: "decide", by: "elena", action: "APPROVE", reason: "All documents valid and consistent with the application.", at: D(21) + H(16) }] },
  { first: "Ethan", last: "Walker", dob: "1992-05-05", nationality: "United States", address: ["880 Birch Hollow Dr", null, "Columbus", "OH", "43215", "United States"], occupation: "Electrician", employer: "Volt Brothers Electric", funds: "Salary", volume: "$2,000 – $5,000", purpose: "Everyday spending and savings", docs: ["DRIVERS_LICENSE", "PROOF_OF_ADDRESS"], submitted: D(4), steps: [] },
];

function docNumber(type: string, i: number) {
  const n = String(100000 + i * 7919).slice(-6);
  switch (type) {
    case "PASSPORT": return `X${n}${i % 10}`;
    case "DRIVERS_LICENSE": return `DL-${n}-${(i * 13) % 97}`;
    case "NATIONAL_ID": return `ID${n}${(i * 3) % 9}`;
    default: return `NPL-${n}${i}`;
  }
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.featureFlagEnvironment.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.refundPayout.deleteMany();
  await prisma.refundDecision.deleteMany();
  await prisma.refundNote.deleteMany();
  await prisma.refundCase.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.kycDecision.deleteMany();
  await prisma.kycNote.deleteMany();
  await prisma.kycDocument.deleteMany();
  await prisma.kycApplication.deleteMany();
  await prisma.user.deleteMany();

  const u = {} as Record<UserKey, { id: string; name: string; role: string; title: string | null }>;
  for (const x of users) {
    const { key, ...data } = x;
    u[key] = await prisma.user.create({ data });
  }

  const statusAfter: Record<string, Record<string, string>> = {
    APPROVE: { IN_REVIEW: "APPROVED", ESCALATED: "APPROVED" },
    REJECT: { IN_REVIEW: "REJECTED", INFO_REQUESTED: "REJECTED", ESCALATED: "REJECTED" },
    REQUEST_INFO: { IN_REVIEW: "INFO_REQUESTED", ESCALATED: "INFO_REQUESTED" },
    ESCALATE: { IN_REVIEW: "ESCALATED", INFO_REQUESTED: "ESCALATED" },
    RESUME_REVIEW: { INFO_REQUESTED: "IN_REVIEW" },
  };
  const auditName: Record<string, string> = {
    APPROVE: "kyc.application.approved",
    REJECT: "kyc.application.rejected",
    REQUEST_INFO: "kyc.application.info_requested",
    ESCALATE: "kyc.application.escalated",
    RESUME_REVIEW: "kyc.application.review_resumed",
  };

  // Oldest first so references increase with submission time.
  const ordered = [...apps].sort((a, b) => b.submitted - a.submitted);
  for (const [i, a] of ordered.entries()) {
    const reference = `KYC-${String(10421 + i)}`;
    const submittedAt = ago(a.submitted);
    const [addressLine1, addressLine2, city, region, postalCode, country] = a.address;
    const app = await prisma.kycApplication.create({
      data: {
        reference, firstName: a.first, lastName: a.last,
        email: `${a.first}.${a.last.split(" ")[0]}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "") + "@mail.example",
        phone: `+1 555 01${String(10 + i).padStart(2, "0")}`,
        dateOfBirth: new Date(a.dob), nationality: a.nationality,
        addressLine1, addressLine2, city, region, postalCode, country,
        occupation: a.occupation, employer: a.employer, sourceOfFunds: a.funds,
        expectedMonthlyVolume: a.volume, accountPurpose: a.purpose,
        taxIdLast4: String(1000 + ((i * 7331) % 9000)).slice(-4),
        submittedAt,
      },
    });

    for (const [j, type] of a.docs.entries()) {
      const isAddress = type === "PROOF_OF_ADDRESS";
      const expired = a.expiredDoc && !isAddress;
      await prisma.kycDocument.create({
        data: {
          applicationId: app.id, type,
          fileName: `${type.toLowerCase()}_${reference.toLowerCase()}.svg`,
          documentNumber: docNumber(type, i * 3 + j),
          issuingCountry: isAddress ? country : a.nationality,
          issuedAt: isAddress ? ago(a.submitted + D(20 + j)) : new Date(2016 + (i % 6), (i * 5) % 12, 1 + (i % 27)),
          expiresAt: isAddress ? null : expired ? ago(D(240)) : new Date(2029 + (i % 5), (i * 5) % 12, 1 + (i % 27)),
          uploadedAt: submittedAt,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: null, actorName: `${a.first} ${a.last} (customer)`, actorRole: "CUSTOMER",
        module: "kyc", action: "kyc.application.submitted", entityType: "KycApplication",
        entityId: app.id, entityRef: reference, toStatus: "SUBMITTED", createdAt: submittedAt,
        metadata: JSON.stringify({ documents: a.docs.length }),
      },
    });

    let status = "SUBMITTED";
    let reviewer: string | null = null;
    let decidedAt: Date | null = null;
    for (const s of a.steps) {
      const at = ago(s.at);
      const actor = u[s.by];
      const base = { actorId: actor.id, actorName: actor.name, actorRole: actor.role, module: "kyc", entityType: "KycApplication", entityId: app.id, entityRef: reference, createdAt: at };
      if (s.kind === "assign") {
        const from = status;
        reviewer = u[s.to].id;
        if (status === "SUBMITTED") status = "IN_REVIEW";
        await prisma.auditLog.create({ data: { ...base, action: "kyc.application.assigned", fromStatus: from, toStatus: status, metadata: JSON.stringify({ reviewerId: reviewer, reviewerName: u[s.to].name, previousReviewerId: null }) } });
      } else if (s.kind === "note") {
        const note = await prisma.kycNote.create({ data: { applicationId: app.id, authorId: actor.id, body: s.body, createdAt: at } });
        await prisma.auditLog.create({ data: { ...base, action: "kyc.note.added", metadata: JSON.stringify({ noteId: note.id }) } });
      } else {
        const to = statusAfter[s.action][status];
        if (!to) throw new Error(`Invalid seed transition ${status} -> ${s.action} for ${reference}`);
        const decision = await prisma.kycDecision.create({ data: { applicationId: app.id, reviewerId: actor.id, action: s.action, fromStatus: status, toStatus: to, reason: s.reason, createdAt: at } });
        await prisma.auditLog.create({ data: { ...base, action: auditName[s.action], fromStatus: status, toStatus: to, reason: s.reason, metadata: JSON.stringify({ decisionId: decision.id }) } });
        status = to;
        if (to === "APPROVED" || to === "REJECTED") decidedAt = at;
      }
    }
    await prisma.kycApplication.update({ where: { id: app.id }, data: { status, assignedReviewerId: reviewer, decidedAt } });
  }

  const refunds = await seedRefunds(prisma, u);
  const flagCount = await seedFlags(prisma, u);
  console.log(`Seeded ${users.length} users, ${apps.length} fictional KYC applications, ${refunds} fictional refund cases and ${flagCount} feature flags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
