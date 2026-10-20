/**
 * Renders fictional sample identity documents as SVG. Every image is
 * watermarked "SPECIMEN" — these are not real documents and contain no real
 * personal data. No OCR or automated verification is performed on them.
 */

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver's license",
  NATIONAL_ID: "National ID card",
  PROOF_OF_ADDRESS: "Proof of address",
};

type Doc = {
  type: string;
  documentNumber: string | null;
  issuingCountry: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
};
type Person = {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nationality: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const d = (v: Date | null) =>
  v ? new Date(v).toISOString().slice(0, 10) : "—";

function field(x: number, y: number, label: string, value: string, size = 18) {
  return `<text x="${x}" y="${y}" font-size="11" fill="#64748b" letter-spacing="1">${esc(label.toUpperCase())}</text>
<text x="${x}" y="${y + size + 4}" font-size="${size}" fill="#0f172a" font-weight="600">${esc(value)}</text>`;
}

function portrait(x: number, y: number, w: number, h: number, seed: string) {
  const hues = [210, 160, 25, 280, 340, 45];
  const hue = hues[seed.charCodeAt(0) % hues.length];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="hsl(${hue} 30% 88%)"/>
<circle cx="${x + w / 2}" cy="${y + h * 0.38}" r="${w * 0.22}" fill="hsl(${hue} 20% 62%)"/>
<path d="M${x + w * 0.15} ${y + h} Q${x + w / 2} ${y + h * 0.5} ${x + w * 0.85} ${y + h} Z" fill="hsl(${hue} 20% 62%)"/>`;
}

function watermark(w: number, h: number) {
  return `<g opacity="0.12" transform="rotate(-20 ${w / 2} ${h / 2})">
<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="${Math.round(w / 9)}" font-weight="800" fill="#dc2626">SPECIMEN</text>
<text x="${w / 2}" y="${h / 2 + w / 16}" text-anchor="middle" font-size="${Math.round(w / 30)}" font-weight="700" fill="#dc2626">FICTIONAL SAMPLE — NOT A REAL DOCUMENT</text></g>`;
}

function mrz(p: Person, doc: Doc) {
  const name = `${p.lastName}<<${p.firstName}`.toUpperCase().replace(/[^A-Z<]/g, "<");
  const l1 = `P<${(doc.issuingCountry ?? "XXX").slice(0, 3).toUpperCase()}${name}`.padEnd(44, "<").slice(0, 44);
  const l2 = `${(doc.documentNumber ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()}<0${d(p.dateOfBirth).replace(/-/g, "").slice(2)}<<<<<<<<<<<<<`
    .padEnd(44, "<")
    .slice(0, 44);
  return [l1, l2];
}

function card(doc: Doc, p: Person, title: string, color: string) {
  const w = 860, h = 540;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="ui-sans-serif, system-ui, sans-serif">
<rect width="${w}" height="${h}" rx="28" fill="#f8fafc"/>
<rect width="${w}" height="${h}" rx="28" fill="none" stroke="${color}" stroke-width="6"/>
<rect x="0" y="0" width="${w}" height="92" rx="28" fill="${color}"/><rect x="0" y="60" width="${w}" height="32" fill="${color}"/>
<text x="40" y="44" font-size="15" fill="#e2e8f0" letter-spacing="3">${esc((doc.issuingCountry ?? "").toUpperCase())}</text>
<text x="40" y="74" font-size="26" fill="#fff" font-weight="700">${esc(title)}</text>
${portrait(40, 124, 200, 250, p.firstName + p.lastName)}
${field(280, 135, "Surname", p.lastName.toUpperCase())}
${field(280, 195, "Given names", p.firstName.toUpperCase())}
${field(280, 255, "Date of birth", d(p.dateOfBirth))}
${field(560, 255, "Nationality", p.nationality)}
${field(280, 315, "Document no.", doc.documentNumber ?? "—")}
${field(560, 315, "Expires", d(doc.expiresAt))}
${field(280, 375, "Issued", d(doc.issuedAt))}
${field(40, 420, "Address", `${p.addressLine1}, ${p.city}`, 16)}
<text x="40" y="505" font-size="12" fill="#94a3b8">Fictional sample generated for the internal KYC demo</text>
${watermark(w, h)}
</svg>`;
}

function passport(doc: Doc, p: Person) {
  const w = 860, h = 600;
  const [l1, l2] = mrz(p, doc);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="ui-sans-serif, system-ui, sans-serif">
<rect width="${w}" height="${h}" rx="18" fill="#eef2ff"/>
<rect x="0" y="0" width="${w}" height="80" rx="18" fill="#1e3a8a"/><rect x="0" y="50" width="${w}" height="30" fill="#1e3a8a"/>
<text x="40" y="52" font-size="26" fill="#fff" font-weight="700" letter-spacing="2">PASSPORT</text>
<text x="${w - 40}" y="52" font-size="16" fill="#c7d2fe" text-anchor="end" letter-spacing="2">${esc((doc.issuingCountry ?? "").toUpperCase())}</text>
${portrait(40, 112, 210, 270, p.firstName + p.lastName)}
${field(290, 120, "Type / Code", `P / ${(doc.issuingCountry ?? "XXX").slice(0, 3).toUpperCase()}`)}
${field(560, 120, "Passport no.", doc.documentNumber ?? "—")}
${field(290, 180, "Surname", p.lastName.toUpperCase())}
${field(290, 240, "Given names", p.firstName.toUpperCase())}
${field(290, 300, "Nationality", p.nationality)}
${field(560, 300, "Date of birth", d(p.dateOfBirth))}
${field(290, 360, "Date of issue", d(doc.issuedAt))}
${field(560, 360, "Date of expiry", d(doc.expiresAt))}
<rect x="0" y="470" width="${w}" height="130" fill="#fff"/>
<text x="40" y="520" font-size="26" font-family="ui-monospace, monospace" fill="#0f172a" letter-spacing="2">${esc(l1)}</text>
<text x="40" y="565" font-size="26" font-family="ui-monospace, monospace" fill="#0f172a" letter-spacing="2">${esc(l2)}</text>
${watermark(w, h)}
</svg>`;
}

function utilityBill(doc: Doc, p: Person) {
  const w = 680, h = 880;
  const issued = d(doc.issuedAt);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="ui-sans-serif, system-ui, sans-serif">
<rect width="${w}" height="${h}" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
<rect x="0" y="0" width="${w}" height="110" fill="#065f46"/>
<text x="40" y="60" font-size="28" fill="#fff" font-weight="700">Northwind Power &amp; Light</text>
<text x="40" y="88" font-size="14" fill="#a7f3d0">Fictional utility company · Account statement</text>
<text x="40" y="170" font-size="13" fill="#64748b">BILLED TO</text>
<text x="40" y="196" font-size="20" fill="#0f172a" font-weight="600">${esc(`${p.firstName} ${p.lastName}`)}</text>
<text x="40" y="222" font-size="16" fill="#334155">${esc(p.addressLine1)}</text>
${p.addressLine2 ? `<text x="40" y="244" font-size="16" fill="#334155">${esc(p.addressLine2)}</text>` : ""}
<text x="40" y="${p.addressLine2 ? 266 : 244}" font-size="16" fill="#334155">${esc(`${p.city}, ${p.region} ${p.postalCode}`)}</text>
<text x="40" y="${p.addressLine2 ? 288 : 266}" font-size="16" fill="#334155">${esc(p.country)}</text>
${field(420, 170, "Statement date", issued, 18)}
${field(420, 230, "Account no.", doc.documentNumber ?? "—", 18)}
<line x1="40" y1="330" x2="${w - 40}" y2="330" stroke="#e2e8f0" stroke-width="2"/>
<text x="40" y="370" font-size="16" fill="#0f172a" font-weight="600">Charges this period</text>
${[["Electricity usage (412 kWh)", "68.42"], ["Delivery charge", "14.10"], ["Taxes and fees", "6.31"]]
  .map(([k, v], i) => `<text x="40" y="${410 + i * 34}" font-size="15" fill="#334155">${k}</text><text x="${w - 40}" y="${410 + i * 34}" font-size="15" fill="#334155" text-anchor="end">${v}</text>`)
  .join("")}
<line x1="40" y1="510" x2="${w - 40}" y2="510" stroke="#e2e8f0" stroke-width="2"/>
<text x="40" y="548" font-size="18" fill="#0f172a" font-weight="700">Amount due</text>
<text x="${w - 40}" y="548" font-size="18" fill="#0f172a" font-weight="700" text-anchor="end">88.83</text>
<text x="40" y="820" font-size="12" fill="#94a3b8">Fictional sample generated for the internal KYC demo</text>
${watermark(w, h)}
</svg>`;
}

export function renderDocumentSvg(doc: Doc, person: Person): string {
  switch (doc.type) {
    case "PASSPORT":
      return passport(doc, person);
    case "DRIVERS_LICENSE":
      return card(doc, person, "Driver License", "#9a3412");
    case "NATIONAL_ID":
      return card(doc, person, "National Identity Card", "#0f766e");
    case "PROOF_OF_ADDRESS":
      return utilityBill(doc, person);
    default:
      return card(doc, person, "Identity Document", "#334155");
  }
}
