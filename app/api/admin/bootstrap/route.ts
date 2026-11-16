import { bootstrapFirstSuperAdmin } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { requestMeta } from "@/lib/request-meta";

/** Files the first super admin. Refuses once any super admin profile exists. */
export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const result = await bootstrapFirstSuperAdmin(requestMeta(request.headers));
  if (!result.ok) {
    const body = result.status === 502 ? { error: result.error, emailSent: false } : { error: result.error };
    return json(body, result.status);
  }
  return json({ ok: true, emailSent: true });
}
