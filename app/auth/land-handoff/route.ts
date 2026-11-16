import { NextResponse } from "next/server";
import { originBlock } from "@/lib/http";
import { landDeskAction, landHandoffDocument, readHandoffSecret, signLandHandoff } from "@/lib/landHandoff";
import { getGate } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;

  const gate = await getGate();
  if (gate.kind === "mfa") return NextResponse.redirect(new URL("/login?mfa=1", request.url));
  if (gate.kind !== "user") return NextResponse.redirect(new URL("/login", request.url));
  if (gate.user.permissions.can_access_land !== true) {
    return page("Land Desk is not assigned to this account.", 403);
  }

  const secret = readHandoffSecret();
  if (!secret) {
    return page("Land Desk handoff is not configured. Set LAND_HANDOFF_SECRET on the hub and on Land.", 503);
  }
  const token = signLandHandoff(gate.user.email, secret);
  if (!token) return page("This hub account has no email Land Desk can match.", 403);

  const action = landDeskAction();
  return new NextResponse(landHandoffDocument(token, action), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      "content-security-policy": `default-src 'none'; base-uri 'none'; form-action ${new URL(action).origin}; script-src 'unsafe-inline'`,
    },
  });
}

function page(message: string, status: number) {
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Land Desk</title><body><p>${escapeHtml(message)}</p><p><a href="/dashboard">Back to the desk</a></p></body></html>`;
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
