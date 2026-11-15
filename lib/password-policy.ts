export type PasswordAssessment = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  score: number;
  ok: boolean;
};

export function assessPassword(password: string): PasswordAssessment {
  const length = password.length >= 10;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const score = [length, upper && lower, number, special].filter(Boolean).length;
  return {
    length,
    upper,
    lower,
    number,
    special,
    score,
    ok: length && upper && lower && number && special,
  };
}

export const PASSWORD_HINT = "At least 10 characters, with upper and lower case, a number, and a symbol.";
