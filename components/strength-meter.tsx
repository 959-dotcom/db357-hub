import { assessPassword } from "@/lib/password-policy";

const CHECKS = [
  { key: "length", label: "10 or more characters" },
  { key: "case", label: "Upper and lower case" },
  { key: "number", label: "A number" },
  { key: "special", label: "A symbol" },
] as const;

export function StrengthMeter({ password }: { password: string }) {
  const assessment = assessPassword(password);
  const flags = {
    length: assessment.length,
    case: assessment.upper && assessment.lower,
    number: assessment.number,
    special: assessment.special,
  };
  return (
    <div className="mt-3">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {CHECKS.map((check, index) => (
          <span
            key={check.key}
            className="h-1 rounded-full"
            style={{ background: index < assessment.score ? "#D4AF37" : "rgba(255,255,255,0.08)" }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {CHECKS.map((check) => (
          <li key={check.key} className={`text-xs ${flags[check.key] ? "text-goldsoft" : "text-mute"}`}>
            {flags[check.key] ? "●" : "○"} {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
