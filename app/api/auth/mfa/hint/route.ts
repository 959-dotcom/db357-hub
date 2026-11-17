import { mockMfaHint } from "@/lib/auth-service";
import { json } from "@/lib/http";

export async function GET() {
  const code = await mockMfaHint();
  if (!code) return json({ error: "No mock authenticator is waiting." }, 404);
  return json({ code });
}
