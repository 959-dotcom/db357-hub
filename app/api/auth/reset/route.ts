import { resetPassword } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson, requestMeta } from "@/lib/request-meta";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return json({ error: "A new password is required." }, 400);
  const result = await resetPassword(
    {
      token: typeof body?.token === "string" ? body.token : undefined,
      code: typeof body?.code === "string" ? body.code : undefined,
      tokenHash: typeof body?.tokenHash === "string" ? body.tokenHash : undefined,
      password,
    },
    requestMeta(request.headers),
  );
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
