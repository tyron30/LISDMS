"use client";

import { Check, X } from "lucide-react";

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const RULES: Rule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
];

export function passwordMeetsAllRules(pw: string) {
  return RULES.every((r) => r.test(pw));
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  return (
    <ul className="space-y-1 text-xs">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className={met ? "flex items-center gap-1.5 text-success" : "flex items-center gap-1.5 text-muted"}>
            {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
