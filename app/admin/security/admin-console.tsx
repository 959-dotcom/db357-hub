"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_CATALOG } from "@/lib/apps";
import { ACTION_LABEL, ROLE_LABEL, STATUS_LABEL, formatWhen, remainingLabel } from "@/lib/format";
import { assessPassword } from "@/lib/password-policy";
import { AUDIT_ACTIONS, EMPTY_PERMISSIONS, type AuditRecord, type Permissions, type PublicUser, type Role, type Status } from "@/lib/types";
import { PasswordField } from "@/components/password-field";
import { StrengthMeter } from "@/components/strength-meter";

export function AdminConsole({ users, audits }: { users: PublicUser[]; audits: AuditRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<string>("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [permissions, setPermissions] = useState<Permissions>({ ...EMPTY_PERMISSIONS });
  const [now] = useState(() => Date.now());

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.fullName} ${user.email} ${user.role}`.toLowerCase().includes(needle));
  }, [query, users]);

  const visibleAudits = useMemo(() => {
    const needle = auditQuery.trim().toLowerCase();
    return audits.filter((row) => {
      if (action !== "all" && row.action !== action) return false;
      if (!needle) return true;
      return `${row.email ?? ""} ${row.ipAddress ?? ""} ${row.action} ${row.targetApp ?? ""}`.toLowerCase().includes(needle);
    });
  }, [action, auditQuery, audits]);

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "The change was refused.");
      return;
    }
    router.refresh();
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    if (!assessPassword(password).ok) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName, email, password, role, permissions }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setError(data.error || "The account could not be filed.");
    else {
      setNotice("Account filed. It stays pending until you approve it.");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("staff");
      setPermissions({ ...EMPTY_PERMISSIONS });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-[#d7b4b4]" role="alert">{error}</p> : null}
      {notice ? <p className="text-sm text-goldsoft">{notice}</p> : null}

      <form onSubmit={createUser} className="surface p-6">
        <p className="eyebrow">Provision</p>
        <h2 className="mt-3 text-xl font-medium">Create an account</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label>
            <span className="label">Name</span>
            <input className="field" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label>
            <span className="label">Email</span>
            <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span className="label">Role</span>
            <select className="field" value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="agent">Agent</option>
            </select>
          </label>
          <PasswordField label="Temporary password" name="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
        </div>
        <StrengthMeter password={password} />
        <div className="mt-4 flex flex-wrap gap-3">
          {APP_CATALOG.map((desk) => (
            <label key={desk.key} className="inline-flex items-center gap-2 text-sm text-mute">
              <input
                type="checkbox"
                checked={permissions[desk.permission]}
                onChange={(event) => setPermissions((current) => ({ ...current, [desk.permission]: event.target.checked }))}
              />
              {desk.name}
            </label>
          ))}
        </div>
        <button className="btn-gold mt-6" disabled={busy || !assessPassword(password).ok} type="submit">
          {busy ? "Filing" : "Create pending account"}
        </button>
      </form>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
          <div>
            <p className="eyebrow">Authority</p>
            <h2 className="mt-2 text-xl font-medium">Permission matrix</h2>
          </div>
          <label className="block">
            <span className="label">Search</span>
            <input className="field w-64" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[11px] tracking-[0.14em] text-mute">
              <tr>
                <th className="px-4 py-3 font-normal">ACCOUNT</th>
                <th className="px-4 py-3 font-normal">ROLE</th>
                <th className="px-4 py-3 font-normal">STATUS</th>
                {APP_CATALOG.map((desk) => (
                  <th key={desk.key} className="px-3 py-3 font-normal">{desk.name.toUpperCase()}</th>
                ))}
                <th className="px-4 py-3 font-normal">LOCK</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => {
                const locked = Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > now);
                return (
                  <tr key={user.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-4">
                      <div>{user.fullName}</div>
                      <div className="text-xs text-mute">{user.email}</div>
                    </td>
                    <td className="px-4 py-4 text-mute">{ROLE_LABEL[user.role]}</td>
                    <td className="px-4 py-4">
                      <select
                        className="field py-2"
                        value={user.status}
                        aria-label={`Status for ${user.fullName}`}
                        onChange={(event) => void patch(user.id, { status: event.target.value as Status })}
                      >
                        <option value="pending">{STATUS_LABEL.pending}</option>
                        <option value="active">{STATUS_LABEL.active}</option>
                        <option value="suspended">{STATUS_LABEL.suspended}</option>
                      </select>
                    </td>
                    {APP_CATALOG.map((desk) => (
                      <td key={desk.key} className="px-3 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={user.permissions[desk.permission]}
                          aria-label={`${desk.name} for ${user.fullName}`}
                          className={`relative h-6 w-11 rounded-full border ${user.permissions[desk.permission] ? "border-gold/70 bg-gold/15" : "border-white/10"}`}
                          onClick={() => void patch(user.id, { permissions: { [desk.permission]: !user.permissions[desk.permission] } })}
                        >
                          <span className={`absolute top-1 h-3.5 w-3.5 rounded-full ${user.permissions[desk.permission] ? "right-1 bg-goldsoft" : "left-1 bg-mute"}`} />
                        </button>
                      </td>
                    ))}
                    <td className="px-4 py-4">
                      {locked && user.lockedUntil ? (
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-goldsoft">{remainingLabel(user.lockedUntil, now)}</span>
                          <button type="button" className="text-xs text-goldsoft" onClick={() => void patch(user.id, { unlock: true })}>
                            Unlock
                          </button>
                        </div>
                      ) : user.failedLoginAttempts > 0 ? (
                        <button type="button" className="text-xs text-mute" onClick={() => void patch(user.id, { unlock: true })}>
                          Clear {user.failedLoginAttempts}
                        </button>
                      ) : (
                        <span className="text-mute">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2 className="mt-2 text-xl font-medium">Audit log</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              <span className="label">Action</span>
              <select className="field w-52" value={action} onChange={(event) => setAction(event.target.value)}>
                <option value="all">All</option>
                {AUDIT_ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {ACTION_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Filter</span>
              <input className="field w-56" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Email, IP, desk" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] tracking-[0.14em] text-mute">
              <tr>
                <th className="px-6 py-3 font-normal">TIME</th>
                <th className="px-6 py-3 font-normal">ACTION</th>
                <th className="px-6 py-3 font-normal">EMAIL</th>
                <th className="px-6 py-3 font-normal">IP</th>
                <th className="px-6 py-3 font-normal">DESK</th>
              </tr>
            </thead>
            <tbody>
              {visibleAudits.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-mute" colSpan={5}>
                    No matching entries.
                  </td>
                </tr>
              ) : null}
              {visibleAudits.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]" title={row.userAgent || undefined}>
                  <td className="px-6 py-4 tabular-nums text-mute">{formatWhen(row.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div>{ACTION_LABEL[row.action]}</div>
                    <div className="text-[11px] tracking-[0.08em] text-mute">{row.action}</div>
                  </td>
                  <td className="px-6 py-4 text-mute">{row.email || "—"}</td>
                  <td className="px-6 py-4 tabular-nums text-mute">{row.ipAddress || "—"}</td>
                  <td className="px-6 py-4 text-mute">{row.targetApp || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
