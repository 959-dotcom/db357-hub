import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubShell } from "@/components/hub-shell";
import { APP_CATALOG, appsFor, isAppKey } from "@/lib/apps";
import { guardApp } from "@/lib/appGuard";
import { getAlerts } from "@/lib/auth-service";
import { getGate } from "@/lib/session";

export const metadata: Metadata = { title: "Clearance" };

export default async function GuardReferencePage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  if (!isAppKey(app)) notFound();
  await guardApp(app);
  const gate = await getGate();
  if (gate.kind !== "user") notFound();
  const desk = APP_CATALOG.find((item) => item.key === app)!;
  const alerts = await getAlerts(gate.user);
  const desks = appsFor(gate.user.permissions);
  return (
    <HubShell
      user={gate.user}
      alerts={alerts}
      desks={desks.map((item) => ({ key: item.key, name: item.name, subtitle: item.subtitle, href: item.href }))}
    >
      <p className="eyebrow">Clearance</p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">{desk.name} is cleared for this session.</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-mute">{desk.description}</p>
      <a href={desk.href} className="btn-gold mt-8 inline-flex">
        Open desk
      </a>
    </HubShell>
  );
}
