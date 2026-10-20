import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getDocument } from "@/modules/kyc/service";
import { renderDocumentSvg } from "@/modules/kyc/documents";

// GET /api/kyc/documents/:id/image — renders the fictional sample document (auth required)
export async function GET(_req: Request, ctx: RouteContext<"/api/kyc/documents/[id]/image">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const doc = await getDocument(user, id);
    const svg = renderDocumentSvg(doc, doc.application);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
