import { updateProfile } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson } from "@/lib/request-meta";
import { currentUser } from "@/lib/session";
import { cleanName, cleanPhone } from "@/lib/validate";

export async function PATCH(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const body = await readJson(request);
  const fullName = cleanName(body?.fullName);
  const phone = cleanPhone(body?.phone);
  if (!fullName || phone === null) return json({ error: "Name or phone is not valid." }, 400);
  const result = await updateProfile(user, fullName, phone);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
