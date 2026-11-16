import type { APP_CATALOG } from "@/lib/apps";
import { landLaunchHref } from "@/lib/landHandoff";

type Desk = (typeof APP_CATALOG)[number];

export function AppCard({ app }: { app: Desk }) {
  return (
    <article className="surface flex min-h-[230px] flex-col p-6 shadow-desk">
      <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-mute">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B7A36A]" />
          OPERATIONAL
        </span>
        <span className="tabular-nums text-goldsoft">{app.subtitle.toUpperCase()}</span>
      </div>
      <h2 className="mt-6 text-2xl font-medium tracking-tight">{app.name}</h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-mute">{app.description}</p>
      <a href={landLaunchHref(app.key, app.href)} className="quiet-link mt-6 inline-flex items-center gap-2 text-sm">
        Open
        <span aria-hidden>→</span>
      </a>
    </article>
  );
}
