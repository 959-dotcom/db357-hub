import "server-only";
import { createHmac, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(size = 20) {
  const bytes = randomBytes(size);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += ALPHABET[Number.parseInt(chunk, 2)];
  }
  return out;
}

function decodeBase32(input: string) {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, at = Date.now(), step = 30) {
  const counter = Math.floor(at / 1000 / step);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, token: string, window = 1) {
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const now = Date.now();
  for (let drift = -window; drift <= window; drift += 1) {
    if (totpCode(secret, now + drift * 30_000) === cleaned) return true;
  }
  return false;
}

export function otpauthUri(email: string, secret: string) {
  const label = encodeURIComponent(`DB357:${email}`);
  const issuer = encodeURIComponent("DB357");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
