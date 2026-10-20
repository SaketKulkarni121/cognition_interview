import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, ValidationError } from "./errors";
import { requireUser } from "./auth/session";
import type { SessionUser } from "./auth/permissions";

type Handler<C> = (ctx: { req: Request; user: SessionUser; params: C }) => Promise<unknown>;

/**
 * Wraps a route handler with authentication and consistent JSON error handling.
 * Every API route goes through this so authorization failures, validation
 * errors and invalid transitions map to stable HTTP status codes.
 */
export function apiHandler<C = Record<string, never>>(handler: Handler<C>) {
  return async (req: Request, context: { params: Promise<C> }) => {
    try {
      const user = await requireUser();
      const params = (await context?.params) ?? ({} as C);
      const result = await handler({ req, user, params });
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 },
  );
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  try {
    return schema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError(err.issues[0]?.message ?? "Invalid request", err.issues);
    }
    throw err;
  }
}
