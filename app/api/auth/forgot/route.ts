import { requestReset } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson, requestMeta } from "@/lib/request-meta";
import { cleanEmail } from "@/lib/validate";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  const email = cleanEmail(body?.email);
  if (!email) return json({ error: "A valid email is required." }, 400);
  const result = await requestReset(email, requestMeta(request.headers));
  return json({
    ok: true,
    message: "If the account exists, a reset link has been issued.",
    devResetUrl: "devResetUrl" in result ? result.devResetUrl : undefined,
  });
}
