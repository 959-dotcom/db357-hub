import type { Metadata } from "next";
import { HubShell } from "@/components/hub-shell";
import { appsFor } from "@/lib/apps";
import { getAlerts, listMyAudits } from "@/lib/auth-service";
import { ACTION_LABEL, ROLE_LABEL, formatWhen } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [alerts, history] = await Promise.all([getAlerts(user), listMyAudits(user.id)]);
  const desks = appsFor(user.permissions);
  return (
    <HubShell
      user={user}
      alerts={alerts}
      desks={desks.map((desk) => ({ key: desk.key, name: desk.name, subtitle: desk.subtitle, href: desk.href }))}
    >
      <p className="eyebrow">Profile</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-medium tracking-tight">{user.fullName}</h1>
        <p className="rounded-full border border-[#D4AF37]/40 px-3 py-1 text-[11px] tracking-[0.18em] text-goldsoft">
          {ROLE_LABEL[user.role].toUpperCase()}
        </p>
      </div>
      <p className="mt-3 text-sm text-mute">{user.email}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {desks.length === 0 ? <span className="text-sm text-mute">No desks approved.</span> : null}
        {desks.map((desk) => (
          <span key={desk.key} className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] tracking-[0.14em] text-ivory">
            {desk.name.toUpperCase()}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs tabular-nums text-mute">Last sign-in {formatWhen(user.lastLoginAt)}</p>
      <div className="mt-10">
        <ProfileEditor user={user} />
      </div>
      <section className="surface mt-5 overflow-hidden">
        <div className="border-b border-white/[0.08] px-6 py-5">
          <p className="eyebrow">History</p>
          <h2 className="mt-2 text-xl font-medium">Recent sign-in activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] tracking-[0.16em] text-mute">
              <tr>
                <th className="px-6 py-3 font-normal">TIME</th>
                <th className="px-6 py-3 font-normal">ACTION</th>
                <th className="px-6 py-3 font-normal">IP</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-mute" colSpan={3}>
                    No activity yet.
                  </td>
                </tr>
              ) : null}
              {history.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="px-6 py-4 tabular-nums text-mute">{formatWhen(row.createdAt)}</td>
                  <td className="px-6 py-4">{ACTION_LABEL[row.action]}</td>
                  <td className="px-6 py-4 tabular-nums text-mute">{row.ipAddress || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </HubShell>
  );
}
