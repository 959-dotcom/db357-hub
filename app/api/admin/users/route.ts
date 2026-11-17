import { createAccount, metaFromHeaders } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson } from "@/lib/request-meta";
import { currentUser } from "@/lib/session";
import { cleanEmail, cleanName, cleanPermissions, isRole } from "@/lib/validate";

async function superAdmin() {
  const user = await currentUser();
  if (!user) return { error: json({ error: "Sign in required." }, 401) };
  if (user.role !== "super_admin") return { error: json({ error: "This desk is not on your authority." }, 403) };
  return { user };
}

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const gate = await superAdmin();
  if (gate.error) return gate.error;
  const body = await readJson(request);
  const fullName = cleanName(body?.fullName);
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;
  const permissions = cleanPermissions(body?.permissions);
  if (!fullName || !email || !password || !isRole(role) || !permissions) {
    return json({ error: "Name, email, role, password, and permissions are required." }, 400);
  }
  const result = await createAccount(
    gate.user,
    { fullName, email, password, role, permissions },
    await metaFromHeaders(),
  );
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
