"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import type { AppKey } from "@/lib/apps";
import { ACTION_LABEL, ROLE_LABEL, STATUS_LABEL, formatWhen, initials } from "@/lib/format";
import type { Alert, PublicUser } from "@/lib/types";

type DeskLink = {
  key: AppKey;
  name: string;
  subtitle: string;
  href: string;
};

export function HubShell({
  user,
  alerts,
  desks,
  children,
}: {
  user: PublicUser;
  alerts: Alert[];
  desks: DeskLink[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<"apps" | "bell" | "menu" | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#060709]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(null)}>
            <BrandMark />
            <span className="hidden text-[12px] tracking-[0.32em] sm:inline">DB357</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Clock />
            <AppSwitcher desks={desks} open={open === "apps"} onToggle={() => setOpen(open === "apps" ? null : "apps")} />
            <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] tracking-[0.16em] text-mute md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-goldsoft" />
              {STATUS_LABEL[user.status].toUpperCase()}
            </span>
            <Bell alerts={alerts} open={open === "bell"} onToggle={() => setOpen(open === "bell" ? null : "bell")} />
            <Menu user={user} open={open === "menu"} onToggle={() => setOpen(open === "menu" ? null : "menu")} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-6">{children}</main>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
    };
    tick();
    const id = window.setInterval(tick, 10000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="hidden tabular-nums text-sm text-mute sm:inline">{time}</span>;
}

function AppSwitcher({ desks, open, onToggle }: { desks: DeskLink[]; open: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <button type="button" className="grid h-9 w-9 grid-cols-3 gap-[3px] rounded-lg border border-white/[0.08] p-2" aria-label="Applications" aria-expanded={open} onClick={onToggle}>
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-[3px] w-[3px] rounded-full bg-ivory/80" />
        ))}
      </button>
      {open ? (
        <div className="surface absolute right-0 z-40 mt-3 w-72 p-3 shadow-desk">
          <p className="eyebrow px-2 py-2">Desks</p>
          {desks.length === 0 ? <p className="px-2 py-3 text-sm text-mute">No desks are assigned.</p> : null}
          {desks.map((desk) => (
            <a key={desk.key} href={desk.href} className="block rounded-xl px-2 py-3 hover:bg-white/[0.03]">
              <span className="block text-sm">{desk.name}</span>
              <span className="mt-1 block text-xs tracking-[0.12em] text-mute">{desk.subtitle.toUpperCase()}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Bell({ alerts, open, onToggle }: { alerts: Alert[]; open: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <button type="button" className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08]" aria-label="Notifications" aria-expanded={open} onClick={onToggle}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1.5a4 4 0 0 0-4 4V8.2L2.6 10.4a.6.6 0 0 0 .5.9h9.8a.6.6 0 0 0 .5-.9L12 8.2V5.5a4 4 0 0 0-4-4Z" fill="none" stroke="#F5F5F7" strokeWidth="1" />
          <path d="M6.4 12.2a1.6 1.6 0 0 0 3.2 0" fill="none" stroke="#F5F5F7" strokeWidth="1" />
        </svg>
        {alerts.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] tabular-nums text-ink">
            {alerts.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="surface absolute right-0 z-40 mt-3 w-80 p-3 shadow-desk">
          <p className="eyebrow px-2 py-2">Alerts</p>
          {alerts.length === 0 ? <p className="px-2 py-3 text-sm text-mute">No alerts.</p> : null}
          {alerts.map((alert) => {
            const body = (
              <>
                <span className="block text-sm capitalize">{titleFor(alert.title)}</span>
                <span className="mt-1 block text-xs text-mute">{alert.detail}</span>
                {alert.createdAt ? <span className="mt-1 block text-xs tabular-nums text-mute">{formatWhen(alert.createdAt)}</span> : null}
              </>
            );
            return alert.href ? (
              <Link key={alert.id} href={alert.href} className="block rounded-xl px-2 py-3 hover:bg-white/[0.03]" onClick={onToggle}>
                {body}
              </Link>
            ) : (
              <div key={alert.id} className="px-2 py-3">
                {body}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function titleFor(title: string) {
  const key = title.replaceAll(" ", "_");
  if (key in ACTION_LABEL) return ACTION_LABEL[key as keyof typeof ACTION_LABEL];
  return title;
}

function Menu({ user, open, onToggle }: { user: PublicUser; open: boolean; onToggle: () => void }) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <div className="relative">
      <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-[#D4AF37]/70 text-[11px] tracking-wide text-goldsoft" aria-label="Account" aria-expanded={open} onClick={onToggle}>
        {initials(user.fullName)}
      </button>
      {open ? (
        <div className="surface absolute right-0 z-40 mt-3 w-64 p-3 shadow-desk">
          <div className="px-2 py-2">
            <p className="text-sm">{user.fullName}</p>
            <p className="mt-1 text-xs text-mute">{user.email}</p>
            <p className="mt-3 w-fit rounded-full border border-[#D4AF37]/40 px-2 py-1 text-[10px] tracking-[0.16em] text-goldsoft">
              {ROLE_LABEL[user.role].toUpperCase()}
            </p>
          </div>
          <Link href="/profile" className="block rounded-xl px-2 py-2 text-sm hover:bg-white/[0.03]" onClick={onToggle}>
            Profile
          </Link>
          {user.role === "super_admin" ? (
            <Link href="/admin/security" className="block rounded-xl px-2 py-2 text-sm hover:bg-white/[0.03]" onClick={onToggle}>
              Security
            </Link>
          ) : null}
          <button type="button" className="block w-full rounded-xl px-2 py-2 text-left text-sm text-mute hover:bg-white/[0.03]" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
