import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request-meta";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function originBlock(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin request refused." }, 403);
  return null;
}
