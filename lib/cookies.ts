import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "db357_hub_session";
export const MFA_COOKIE = "db357_hub_mfa";
export const FACTOR_COOKIE = "db357_hub_mfa_factor";

const encoder = new TextEncoder();

/**
 * Cookies on db357.com:
 * Domain=.db357.com; Secure; HttpOnly; SameSite=Lax
 *
 * Http hosts that are not db357.com omit Domain and Secure, including `next start`
 * on localhost. Secure is also set when the request protocol is https.
 * Sibling apps receive the cookie because of Domain. They can validate it only
 * when they share this Supabase project.
 */
export function hubCookieOptions(hostname: string | null | undefined, protocol?: string | null) {
  const host = (hostname ?? "").split(":")[0]?.toLowerCase() ?? "";
  const onApex = host === "db357.com" || host.endsWith(".db357.com");
  const https = (protocol ?? "").toLowerCase().replace(":", "") === "https";
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: onApex || https,
    ...(onApex ? { domain: ".db357.com" } : {}),
  };
}

function sessionSecret() {
  return process.env.HUB_SESSION_SECRET || "db357-hub-dev-session-key";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export async function seal(payload: object) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

export async function unseal<T>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await sign(body);
  if (!safeEqual(expected, signature)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
  } catch {
    return null;
  }
}

export type SessionPayload = {
  sid: string;
  uid: string;
  role: Role;
  exp: number;
};

export type TicketPayload = {
  tid: string;
  uid: string;
  exp: number;
};

export async function readSessionToken(token: string | undefined | null) {
  const payload = await unseal<SessionPayload>(token);
  if (!payload?.sid || !payload.uid || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export async function readTicket(token: string | undefined | null) {
  const payload = await unseal<TicketPayload>(token);
  if (!payload?.tid || !payload.uid || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}
