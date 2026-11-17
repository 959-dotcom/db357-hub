import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Hub and DM-CK must stay on this exact token shape. Audience is dmck, not land. */
export const HANDOFF_VERSION = "v1";
export const HANDOFF_ISSUER = "db357-hub";
export const HANDOFF_AUDIENCE = "dmck";
export const HANDOFF_TTL_SECONDS = 60;
export const HANDOFF_CLOCK_SKEW_SECONDS = 15;
export const MIN_HANDOFF_SECRET_LENGTH = 32;
export const MAX_HANDOFF_TOKEN_LENGTH = 2048;
export const DMCK_LAUNCH_PATH = "/auth/dmck-handoff";

/**
 * The live DM-CK app. https://db357.com/dmck is this hub, not that app.
 * Set DMCK_DESK_URL=https://www.db357.com/dmck only after that path is served by DM-CK.
 */
const DEFAULT_DMCK_ORIGIN = "https://spinlytics-db357.vercel.app";

const JTI_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type HandoffClaims = {
  iss: typeof HANDOFF_ISSUER;
  aud: typeof HANDOFF_AUDIENCE;
  email: string;
  iat: number;
  exp: number;
  jti: string;
};

export function readHandoffSecret(value = process.env.DMCK_HANDOFF_SECRET): string | null {
  const secret = (value ?? "").trim();
  if (secret.length < MIN_HANDOFF_SECRET_LENGTH) return null;
  return secret;
}

export function isHandoffEmail(email: string): boolean {
  if (email.length < 3 || email.length > 320) return false;
  if (/[\s\u0000-\u001f\u007f]/.test(email)) return false;
  const at = email.indexOf("@");
  return at > 0 && at === email.lastIndexOf("@") && at < email.length - 1;
}

export function signDmckHandoff(
  rawEmail: string,
  secret: string,
  options?: { nowMs?: number; jti?: string },
): string | null {
  if (secret.trim().length < MIN_HANDOFF_SECRET_LENGTH || secret !== secret.trim()) return null;
  const email = rawEmail.trim().toLowerCase();
  if (!isHandoffEmail(email)) return null;
  const jti = options?.jti ?? "";
  if (options?.jti !== undefined && !JTI_PATTERN.test(jti)) return null;
  const nonce = options?.jti ?? randomJti();
  if (!JTI_PATTERN.test(nonce)) return null;
  const iat = Math.floor((options?.nowMs ?? Date.now()) / 1000);
  const payload: HandoffClaims = {
    iss: HANDOFF_ISSUER,
    aud: HANDOFF_AUDIENCE,
    email,
    iat,
    exp: iat + HANDOFF_TTL_SECONDS,
    jti: nonce,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${HANDOFF_VERSION}.${body}`).digest().toString("base64url");
  return `${HANDOFF_VERSION}.${body}.${sig}`;
}

export function verifyDmckHandoff(token: string, secret: string, nowMs = Date.now()): HandoffClaims | null {
  if (secret.trim().length < MIN_HANDOFF_SECRET_LENGTH || secret !== secret.trim()) return null;
  if (typeof token !== "string" || token.length < 20 || token.length > MAX_HANDOFF_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HANDOFF_VERSION) return null;
  const [version, body, signature] = parts;
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${version}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const claims = asClaims(parsed);
  if (!claims) return null;
  if (claims.exp - claims.iat !== HANDOFF_TTL_SECONDS) return null;
  const nowSec = Math.floor(nowMs / 1000);
  if (claims.iat > nowSec + HANDOFF_CLOCK_SKEW_SECONDS) return null;
  if (nowSec > claims.exp + HANDOFF_CLOCK_SKEW_SECONDS) return null;
  return claims;
}

/** Only the live DM-CK host, the /dmck path on db357.com, or a local app may receive the token. */
export function dmckDeskAction(raw = process.env.DMCK_DESK_URL): string {
  return allowedDmckAction(raw) ?? `${DEFAULT_DMCK_ORIGIN}/auth/hub`;
}

export function dmckHandoffDocument(token: string, action: string): string {
  const safeToken = escapeHtml(token);
  const safeAction = escapeHtml(action);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>Opening DM-CK</title>
</head>
<body>
<p>Opening DM-CK…</p>
<form method="post" action="${safeAction}">
<input type="hidden" name="token" value="${safeToken}">
<button type="submit">Continue to DM-CK</button>
</form>
<script>document.forms[0].submit()</script>
</body>
</html>`;
}

function allowedDmckAction(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "spinlytics-db357.vercel.app" && url.protocol === "https:") {
      return "https://spinlytics-db357.vercel.app/auth/hub";
    }
    if ((host === "db357.com" || host === "www.db357.com") && url.protocol === "https:") {
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path !== "/dmck") return null;
      return `${url.origin}/dmck/auth/hub`;
    }
    if ((host === "localhost" || host === "127.0.0.1") && (url.protocol === "http:" || url.protocol === "https:")) {
      return `${url.origin}/auth/hub`;
    }
    return null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asClaims(value: unknown): HandoffClaims | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.iss !== HANDOFF_ISSUER || row.aud !== HANDOFF_AUDIENCE) return null;
  if (typeof row.email !== "string" || row.email !== row.email.trim().toLowerCase() || !isHandoffEmail(row.email)) {
    return null;
  }
  if (typeof row.iat !== "number" || typeof row.exp !== "number") return null;
  if (!Number.isInteger(row.iat) || !Number.isInteger(row.exp)) return null;
  if (typeof row.jti !== "string" || !JTI_PATTERN.test(row.jti)) return null;
  return {
    iss: HANDOFF_ISSUER,
    aud: HANDOFF_AUDIENCE,
    email: row.email,
    iat: row.iat,
    exp: row.exp,
    jti: row.jti,
  };
}

function randomJti(): string {
  return randomBytes(16).toString("base64url");
}
