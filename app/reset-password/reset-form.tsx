"use client";

import { useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { StrengthMeter } from "@/components/strength-meter";
import { assessPassword } from "@/lib/password-policy";

export function ResetForm({
  token,
  code,
  tokenHash,
  otpType,
}: {
  token?: string;
  code?: string;
  tokenHash?: string;
  otpType?: "invite" | "recovery";
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readyToCheck, setReadyToCheck] = useState(false);
  const [sessionTokens, setSessionTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const ready = assessPassword(password).ok && password === confirm;
  const linkMissing = !token && !code && !tokenHash && !sessionTokens;

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) setSessionTokens({ accessToken, refreshToken });
    setReadyToCheck(true);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        code,
        tokenHash,
        otpType,
        accessToken: sessionTokens?.accessToken,
        refreshToken: sessionTokens?.refreshToken,
        password,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "The password could not be changed.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return (
    <form onSubmit={onSubmit} className="surface relative px-6 py-7 shadow-desk sm:px-8">
      <div className="hairline absolute left-8 right-8 top-0" />
      <p className="eyebrow">New password</p>
      <h2 className="mt-3 text-xl font-medium">Choose a replacement</h2>
      {readyToCheck && linkMissing ? <p className="mt-3 text-sm text-mute">Open the link from the reset message. It returns you to this desk.</p> : null}
      {done ? (
        <p className="mt-6 text-sm">
          Password updated. <a className="quiet-link" href="/login">Return to sign in</a>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <PasswordField label="New password" name="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
          <StrengthMeter password={password} />
          <PasswordField label="Confirm" name="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {password && confirm && password !== confirm ? <p className="text-sm text-[#d7b4b4]">The two passwords do not match.</p> : null}
          {error ? <p className="text-sm text-[#d7b4b4]" role="alert">{error}</p> : null}
          <button className="btn-gold w-full" disabled={busy || !ready || !readyToCheck || linkMissing} type="submit">
            {busy ? "Saving" : "Update password"}
          </button>
        </div>
      )}
    </form>
  );
}
