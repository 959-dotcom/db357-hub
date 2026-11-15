import { confirmMfa, metaFromHeaders } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson } from "@/lib/request-meta";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code) return json({ error: "Enter the six-digit code." }, 400);
  const result = await confirmMfa(user, code, await metaFromHeaders());
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
