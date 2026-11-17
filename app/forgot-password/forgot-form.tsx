"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as { message?: string; error?: string; devResetUrl?: string };
    if (!response.ok) {
      setError(data.error || "The request could not be sent.");
      setBusy(false);
      return;
    }
    setMessage(data.message || "If the account exists, a reset link has been issued.");
    setLink(data.devResetUrl || "");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="surface relative px-6 py-7 shadow-desk sm:px-8">
      <div className="hairline absolute left-8 right-8 top-0" />
      <p className="eyebrow">Password reset</p>
      <h2 className="mt-3 text-xl font-medium">Request a link</h2>
      <p className="mt-2 text-sm leading-6 text-mute">
        The live desk sends mail through Supabase to https://www.db357.com/reset-password. The local mock shows the link here.
      </p>
      <label className="mt-6 block">
        <span className="label">Email</span>
        <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      {error ? <p className="mt-4 text-sm text-[#d7b4b4]" role="alert">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-ivory">{message}</p> : null}
      {link ? (
        <p className="mt-3 text-sm">
          <Link href={link} className="quiet-link">
            Open the local reset link
          </Link>
        </p>
      ) : null}
      <button className="btn-gold mt-6 w-full" disabled={busy} type="submit">
        {busy ? "Sending" : "Send link"}
      </button>
    </form>
  );
}
