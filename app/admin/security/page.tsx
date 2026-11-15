import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HubShell } from "@/components/hub-shell";
import { appsFor } from "@/lib/apps";
import { getAlerts, listAudits, listUsers, logUnauthorized } from "@/lib/auth-service";
import { requestMeta } from "@/lib/request-meta";
import { requireUser } from "@/lib/session";
import { AdminConsole } from "./admin-console";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser();
  if (user.role !== "super_admin") {
    await logUnauthorized(user, "hub_admin", requestMeta(await headers()));
    redirect("/access-denied");
  }
  const [alerts, users, audits] = await Promise.all([getAlerts(user), listUsers(), listAudits()]);
  const desks = appsFor(user.permissions);
  return (
    <HubShell
      user={user}
      alerts={alerts}
      desks={desks.map((desk) => ({ key: desk.key, name: desk.name, subtitle: desk.subtitle, href: desk.href }))}
    >
      <p className="eyebrow">Security</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-medium tracking-tight">Authority desk</h1>
        <p className="tabular-nums text-sm text-mute">{users.length} accounts</p>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-mute">
        Super Admin only. New accounts stay pending until approved. Lockout counters and this ledger are written on the server.
      </p>
      <div className="mt-10">
        <AdminConsole users={users} audits={audits} />
      </div>
    </HubShell>
  );
}
