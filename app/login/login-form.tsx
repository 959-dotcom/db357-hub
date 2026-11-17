"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { remainingLabel } from "@/lib/format";

export function LoginForm({ initialMfa }: { initialMfa: boolean }) {
  const [phase, setPhase] = useState<"credentials" | "mfa">(initialMfa ? "mfa" : "credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = params.get("type");
    if ((type === "recovery" || type === "invite") && params.get("access_token") && params.get("refresh_token")) {
      window.location.replace(`/reset-password${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (phase !== "mfa") return;
    let stop = false;
    const pull = async () => {
      const response = await fetch("/api/auth/mfa/hint");
      if (!response.ok) return;
      const data = (await response.json()) as { code?: string };
      if (!stop && data.code) setDevCode(data.code);
    };
    void pull();
    const id = window.setInterval(() => void pull(), 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [phase]);

  const locked = lockedUntil ? new Date(lockedUntil).getTime() > now : false;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, totp: phase === "mfa" ? totp : undefined }),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      mfaRequired?: boolean;
      devCode?: string;
      lockedUntil?: string;
    };
    if (data.mfaRequired) {
      setPhase("mfa");
      if (data.devCode) setDevCode(data.devCode);
      setBusy(false);
      return;
    }
    if (data.lockedUntil) {
      setLockedUntil(data.lockedUntil);
      setError(data.error || "This desk is locked.");
      setBusy(false);
      return;
    }
    if (!response.ok) {
      setError(data.error || "Sign-in was refused.");
      setBusy(false);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="surface relative px-6 py-7 shadow-desk sm:px-8">
      <div className="hairline absolute left-8 right-8 top-0" />
      {locked && lockedUntil ? (
        <div className="py-6 text-center">
          <p className="eyebrow">Desk locked</p>
          <p className="mt-4 text-4xl tabular-nums tracking-tight text-goldsoft">{remainingLabel(lockedUntil, now)}</p>
          <p className="mt-3 text-sm text-mute">Try again when the lock expires. Five failures hold the desk for 30 minutes.</p>
        </div>
      ) : phase === "mfa" ? (
        <div>
          <p className="eyebrow">Authenticator</p>
          <h2 className="mt-3 text-xl font-medium">Enter the six-digit code</h2>
          <label className="mt-6 block">
            <span className="label">Code</span>
            <input
              className="field text-center text-2xl tabular-nums tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          {devCode ? (
            <p className="mt-4 text-center text-xs text-mute">
              Local mock code <span className="tabular-nums text-goldsoft">{devCode}</span>
              <button type="button" className="quiet-link ml-3" onClick={() => setTotp(devCode)}>
                Use code
              </button>
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-[#d7b4b4]" role="alert">{error}</p> : null}
          <button className="btn-gold mt-6 w-full" disabled={busy || totp.length !== 6} type="submit">
            {busy ? "Checking" : "Continue"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input
              className="field"
              type="email"
              autoComplete="username"
              value={email}
              spellCheck={false}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <PasswordField label="Password" name="password" value={password} onChange={setPassword} autoComplete="current-password" />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-mute hover:text-ivory">
              Forgot password
            </Link>
          </div>
          {error ? <p className="text-sm text-[#d7b4b4]" role="alert">{error}</p> : null}
          <button className="btn-gold w-full" disabled={busy} type="submit">
            {busy ? "Checking" : "Enter"}
          </button>
        </div>
      )}
    </form>
  );
}
