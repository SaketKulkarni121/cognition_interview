"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHeader, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { apiPost } from "./api-client";

type Note = { id: string; body: string; createdAt: string; author: { name: string; title: string | null } };

export function NotesPanel({ applicationId, notes, canNote }: { applicationId: string; notes: Note[]; canNote: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/kyc/applications/${applicationId}/notes`, { body });
      setBody("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Reviewer notes" description="Internal notes for other reviewers. Not shared with the customer." />
      <CardBody className="space-y-4">
        {canNote && (
          <form onSubmit={submit} className="space-y-2">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note for other reviewers…" aria-label="New note" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="secondary" disabled={busy || !body.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add note
              </Button>
            </div>
          </form>
        )}
        {notes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <MessageSquare className="h-4 w-4" /> No notes yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {notes.map((n) => (
              <li key={n.id} className="flex gap-3">
                <Avatar name={n.author.name} size="xs" className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-900">{n.author.name}</span> · {formatDateTime(n.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
