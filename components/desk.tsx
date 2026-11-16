import { HubShell } from "@/components/hub-shell";
import { AppCard } from "@/components/app-card";
import { appsFor } from "@/lib/apps";
import { landLaunchHref } from "@/lib/landHandoff";
import { getAlerts } from "@/lib/auth-service";
import { greeting, ROLE_LABEL } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function Desk() {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const desks = appsFor(user.permissions);
  return (
    <HubShell
      user={user}
      alerts={alerts}
      desks={desks.map((desk) => ({ key: desk.key, name: desk.name, subtitle: desk.subtitle, href: landLaunchHref(desk.key, desk.href) }))}
    >
      <p className="eyebrow">Private desk</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-medium tracking-tight">{greeting(user.fullName)}</h1>
        <p className="rounded-full border border-[#D4AF37]/40 px-3 py-1 text-[11px] tracking-[0.18em] text-goldsoft">
          {ROLE_LABEL[user.role].toUpperCase()}
        </p>
      </div>
      <p className="mt-4 max-w-xl text-sm leading-6 text-mute">
        {desks.length === 1 ? "1 desk is open on this account." : `${desks.length} desks are open on this account.`}
      </p>
      {desks.length === 0 ? (
        <div className="surface mt-10 px-6 py-10 text-sm text-mute">No desks are assigned. Ask the administrator to grant one.</div>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {desks.map((desk) => (
            <AppCard key={desk.key} app={desk} />
          ))}
        </div>
      )}
    </HubShell>
  );
}
