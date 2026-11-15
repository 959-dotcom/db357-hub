import { metaFromHeaders, updateAccount } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson } from "@/lib/request-meta";
import { currentUser } from "@/lib/session";
import { cleanPermissionPatch, isStatus } from "@/lib/validate";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return json({ error: "Sign in required." }, 401);
  if (user.role !== "super_admin") return json({ error: "This desk is not on your authority." }, 403);
  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return json({ error: "Request could not be read." }, 400);
  const status = body.status === undefined ? undefined : isStatus(body.status) ? body.status : null;
  if (status === null) return json({ error: "Status is not valid." }, 400);
  const permissions = body.permissions === undefined ? undefined : cleanPermissionPatch(body.permissions);
  if (body.permissions !== undefined && !permissions) return json({ error: "Permissions are not valid." }, 400);
  const result = await updateAccount(
    user,
    id,
    { status, unlock: body.unlock === true, permissions: permissions ?? undefined },
    await metaFromHeaders(),
  );
  if (!result.ok) return json({ error: result.error }, 404);
  return json({ ok: true });
}
