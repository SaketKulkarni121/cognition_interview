import { z, type ZodType } from "zod";
import { ValidationError } from "./errors";

/** Shared rules for human decisions recorded by any internal app. */
export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 2000;

export const reasonSchema = z
  .string({ message: "An explanation is required" })
  .trim()
  .min(MIN_REASON_LENGTH, `Please explain your decision (at least ${MIN_REASON_LENGTH} characters)`)
  .max(MAX_REASON_LENGTH, `Explanation must be under ${MAX_REASON_LENGTH} characters`);

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(MAX_REASON_LENGTH),
});
export type NoteInput = z.infer<typeof noteSchema>;

/** Parse service input, converting Zod failures into a 400 ValidationError. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Invalid input", r.error.issues);
  return r.data;
}
