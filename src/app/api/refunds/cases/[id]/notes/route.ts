import { apiHandler, parseBody } from "@/lib/api";
import { noteSchema } from "@/lib/validation";
import { addNote } from "@/modules/refunds/service";

// POST /api/refunds/cases/:id/notes  { body }
export const POST = apiHandler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, noteSchema);
  return { note: await addNote(user, params.id, body) };
});
