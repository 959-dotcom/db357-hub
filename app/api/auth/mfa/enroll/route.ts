import { enrollMfa } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  const result = await enrollMfa(user);
  if (!result.ok) return json({ error: result.error }, 400);
  return json(result);
}
