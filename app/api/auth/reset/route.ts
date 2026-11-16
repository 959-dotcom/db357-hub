import { resetPassword } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";
import { readJson, requestMeta } from "@/lib/request-meta";

function setupToken(value: unknown) {
  if (typeof value !== "string") return undefined;
  const token = value.trim();
  if (token.length < 16 || token.length > 12000 || /\s/.test(token)) return undefined;
  return token;
}

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return json({ error: "A new password is required." }, 400);
  const accessToken = setupToken(body?.accessToken);
  const refreshToken = setupToken(body?.refreshToken);
  const result = await resetPassword(
    {
      token: typeof body?.token === "string" ? body.token : undefined,
      code: typeof body?.code === "string" ? body.code : undefined,
      tokenHash: typeof body?.tokenHash === "string" ? body.tokenHash : undefined,
      otpType: body?.otpType === "invite" ? "invite" : body?.otpType === "recovery" ? "recovery" : undefined,
      accessToken: accessToken && refreshToken ? accessToken : undefined,
      refreshToken: accessToken && refreshToken ? refreshToken : undefined,
      password,
    },
    requestMeta(request.headers),
  );
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
