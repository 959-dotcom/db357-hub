import { signOutAll } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  await signOutAll(user);
  return json({ ok: true });
}
