"use client";

import { useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { StrengthMeter } from "@/components/strength-meter";
import { assessPassword } from "@/lib/password-policy";
import type { PublicUser } from "@/lib/types";

export function ProfileEditor({ user }: { user: PublicUser }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [devCode, setDevCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [enabled, setEnabled] = useState(user.mfaEnabled);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!secret) return;
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
  }, [secret]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setProfileError("");
    setProfileMessage("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName, phone }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setProfileError(data.error || "The profile could not be saved.");
    else {
      setProfileMessage("Saved.");
      window.location.reload();
    }
    setBusy("");
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!assessPassword(next).ok || next !== confirm) return;
    setBusy("password");
    setPasswordError("");
    setPasswordMessage("");
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setPasswordError(data.error || "The password could not be changed.");
    else {
      setPasswordMessage("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    setBusy("");
  }

  async function enroll() {
    setBusy("mfa");
    setMfaError("");
    const response = await fetch("/api/auth/mfa/enroll", { method: "POST" });
    const data = (await response.json()) as { error?: string; qr?: string; secret?: string; devCode?: string };
    if (!response.ok || !data.qr || !data.secret) setMfaError(data.error || "Enrollment could not start.");
    else {
      setQr(data.qr);
      setSecret(data.secret);
      if (data.devCode) setDevCode(data.devCode);
    }
    setBusy("");
  }

  async function confirmMfa(event: React.FormEvent) {
    event.preventDefault();
    setBusy("mfa");
    setMfaError("");
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: mfaCode || devCode }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setMfaError(data.error || "That code was not accepted.");
    else {
      setEnabled(true);
      setMfaMessage("Authenticator active.");
      setQr("");
      setSecret("");
    }
    setBusy("");
  }

  async function signOutAll() {
    if (!confirmAll) {
      setConfirmAll(true);
      return;
    }
    await fetch("/api/auth/signout-all", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="surface p-6">
        <p className="eyebrow">Identity</p>
        <h2 className="mt-3 text-xl font-medium">Name and phone</h2>
        <label className="mt-6 block">
          <span className="label">Name</span>
          <input className="field" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label className="mt-4 block">
          <span className="label">Phone</span>
          <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        {profileError ? <p className="mt-4 text-sm text-[#d7b4b4]">{profileError}</p> : null}
        {profileMessage ? <p className="mt-4 text-sm text-goldsoft">{profileMessage}</p> : null}
        <button className="btn-gold mt-6" disabled={busy === "profile"} type="submit">
          Save
        </button>
      </form>

      <form onSubmit={savePassword} className="surface p-6">
        <p className="eyebrow">Password</p>
        <h2 className="mt-3 text-xl font-medium">Change after a check</h2>
        <div className="mt-6 space-y-4">
          <PasswordField label="Current password" name="current-password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField label="New password" name="new-password" value={next} onChange={setNext} autoComplete="new-password" />
          <StrengthMeter password={next} />
          <PasswordField label="Confirm" name="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {passwordError ? <p className="mt-4 text-sm text-[#d7b4b4]">{passwordError}</p> : null}
        {passwordMessage ? <p className="mt-4 text-sm text-goldsoft">{passwordMessage}</p> : null}
        <button className="btn-gold mt-6" disabled={busy === "password" || !assessPassword(next).ok || next !== confirm} type="submit">
          Update password
        </button>
      </form>

      <section className="surface p-6">
        <p className="eyebrow">Authenticator</p>
        <h2 className="mt-3 text-xl font-medium">{enabled ? "Authenticator active" : "Enroll a code"}</h2>
        {enabled ? <p className="mt-3 text-sm text-mute">Sign-in asks for a six-digit code from this point on.</p> : null}
        {!enabled && !qr ? (
          <button className="btn-ghost mt-6" type="button" onClick={enroll} disabled={busy === "mfa"}>
            Enroll authenticator
          </button>
        ) : null}
        {qr ? (
          <form onSubmit={confirmMfa} className="mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.startsWith("<svg") ? `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}` : qr} alt="Authenticator QR code" className="h-44 w-44 rounded-xl bg-[#0F1117] p-2" />
            <p className="mt-4 break-all text-xs tabular-nums tracking-[0.14em] text-mute">{secret}</p>
            {devCode ? <p className="mt-2 text-xs text-mute">Local mock code <span className="tabular-nums text-goldsoft">{devCode}</span></p> : null}
            <label className="mt-4 block">
              <span className="label">Code</span>
              <input className="field tabular-nums tracking-[0.3em]" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
            <button className="btn-gold mt-4" type="submit" disabled={busy === "mfa"}>
              Confirm
            </button>
          </form>
        ) : null}
        {mfaError ? <p className="mt-4 text-sm text-[#d7b4b4]">{mfaError}</p> : null}
        {mfaMessage ? <p className="mt-4 text-sm text-goldsoft">{mfaMessage}</p> : null}
      </section>

      <section className="surface p-6">
        <p className="eyebrow">Sessions</p>
        <h2 className="mt-3 text-xl font-medium">Sign out of every device</h2>
        <p className="mt-3 text-sm leading-6 text-mute">This revokes the hub session everywhere, including this browser. Scope is global.</p>
        <button className="btn-ghost mt-6" type="button" onClick={signOutAll}>
          {confirmAll ? "Confirm sign out" : "Sign out all devices"}
        </button>
      </section>
    </div>
  );
}
