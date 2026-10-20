"use client";

import { useState } from "react";
import { FileText, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

type Doc = {
  id: string;
  type: string;
  typeLabel: string;
  fileName: string;
  documentNumber: string | null;
  issuingCountry: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  uploadedAt: string;
  expired: boolean;
};

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function DocumentsGallery({ documents }: { documents: Doc[] }) {
  const [open, setOpen] = useState<Doc | null>(null);
  if (documents.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <FileText className="h-4 w-4" /> The customer did not upload any documents.
      </p>
    );
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {documents.map((d) => (
          <button key={d.id} onClick={() => setOpen(d)} className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-md">
            <div className="relative flex aspect-[16/10] items-center justify-center bg-slate-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/kyc/documents/${d.id}/image`} alt={`${d.typeLabel} (fictional sample)`} className="max-h-full max-w-full rounded shadow-sm" />
              <span className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{d.typeLabel}</p>
                <p className="truncate text-xs text-slate-500">{d.documentNumber ?? d.fileName}</p>
              </div>
              {d.expired ? <Badge tone="warning">Expired {formatDate(d.expiresAt)}</Badge> : d.expiresAt ? <Badge>Expires {formatDate(d.expiresAt)}</Badge> : null}
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${open.typeLabel} — fictional sample` : ""} className="max-w-4xl">
        {open && (
          <div className="grid gap-0 md:grid-cols-[1fr_220px]">
            <div className="flex items-center justify-center bg-slate-100 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/kyc/documents/${open.id}/image`} alt={`${open.typeLabel} (fictional sample)`} className="max-h-[70vh] w-full object-contain" />
            </div>
            <dl className="space-y-3 border-t border-slate-200 p-4 md:border-l md:border-t-0">
              <Meta label="Document type" value={open.typeLabel} />
              <Meta label="Number" value={open.documentNumber ?? "—"} />
              <Meta label="Issuing country" value={open.issuingCountry ?? "—"} />
              <Meta label="Issued" value={formatDate(open.issuedAt)} />
              <Meta label="Expires" value={open.expiresAt ? <span className={open.expired ? "text-amber-700" : undefined}>{formatDate(open.expiresAt)}{open.expired && " (expired)"}</span> : "—"} />
              <Meta label="Uploaded" value={formatDate(open.uploadedAt)} />
              <p className="pt-2 text-xs text-slate-500">Compare the details on the document with the customer profile. Nothing on this page is checked automatically.</p>
            </dl>
          </div>
        )}
      </Dialog>
    </>
  );
}
