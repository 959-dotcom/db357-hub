import { login } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson, requestMeta } from "@/lib/request-meta";
import { cleanEmail } from "@/lib/validate";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  if (!body) return json({ error: "Request could not be read." }, 400);
  const totp = typeof body.totp === "string" ? body.totp.trim() : "";
  const email = cleanEmail(body.email) ?? "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!totp && (!email || !password)) return json({ error: "Email and password are required." }, 400);
  const result = await login(email, password, totp || undefined, requestMeta(request.headers));
  if (result.ok) return json({ ok: true });
  if ("mfaRequired" in result) {
    return json({ mfaRequired: true, devCode: result.devCode });
  }
  return json(
    { error: result.error, code: result.code, lockedUntil: result.lockedUntil },
    result.code === "locked" ? 423 : 401,
  );
}
