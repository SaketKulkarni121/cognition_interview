import { apiHandler, parseBody } from "@/lib/api";
import { noteSchema } from "@/modules/kyc/schemas";
import { addNote } from "@/modules/kyc/service";

// POST /api/kyc/applications/:id/notes  { body }
export const POST = apiHandler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, noteSchema);
  return { note: await addNote(user, params.id, body) };
});
