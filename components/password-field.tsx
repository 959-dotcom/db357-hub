"use client";

import { useState } from "react";

export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input
          className="field pr-16"
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tracking-[0.14em] text-mute"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
      </span>
    </label>
  );
}
