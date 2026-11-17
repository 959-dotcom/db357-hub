import { changePassword, metaFromHeaders } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson } from "@/lib/request-meta";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  if (!current || !next) return json({ error: "Current and new passwords are required." }, 400);
  const result = await changePassword(user, current, next, await metaFromHeaders());
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
