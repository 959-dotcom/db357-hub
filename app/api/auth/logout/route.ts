import { NextResponse } from "next/server";
import { signOutCurrent } from "@/lib/auth-service";
import { json, originBlock } from "@/lib/http";

export async function POST(request: Request) {
  const blocked = originBlock(request);
  if (blocked) return blocked;
  await signOutCurrent();
  return json({ ok: true });
}

export async function GET(request: Request) {
  await signOutCurrent();
  return NextResponse.redirect(new URL("/login", request.url));
}
